import * as Sentry from '@sentry/nextjs';
import { addMinutes, isBefore } from 'date-fns';
import { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import { getStripe } from '@/server/stripe';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { isHoldPlaceholderEmail } from '@/lib/constants/booking-hold';
import { sendBookingExpiredEmail } from '@/server/services/email.service';
import { releaseGiftForBookingInTx } from '@/server/services/giftCard-redemption.service';
import { flagStuckCancellationRefunds } from '@/server/services/booking-refund.service';

/**
 * Fallback for legacy rows without an expiresAt — every current creation
 * path sets one, so this only guards hand-inserted data.
 */
const PAYMENT_EXPIRATION_MINUTES = 30;

/** Rows fetched per page of the sweep. */
const SWEEP_BATCH_SIZE = 100;
/**
 * Default time budget of one sweep — comfortably under the cron routes'
 * 300 s maxDuration, so the run always ends by itself (and reports) rather
 * than being cut off mid-booking.
 */
const SWEEP_DEFAULT_BUDGET_MS = 240_000;
/**
 * A session Stripe reports PAID while its booking is still pending this
 * long after its window closed means the confirmation webhook never
 * landed — alert instead of waiting forever.
 */
const PAID_BUT_PENDING_ALERT_MINUTES = 60;

export interface ExpirePendingBookingsResult {
  expired: number;
  deletedHolds: number;
  /** Candidates whose expiration threw (P-16 review: surfaced, not hidden). */
  failed: number;
  /** Left untouched on purpose (paid / settling, or Stripe unreachable). */
  skipped: number;
  /** true when the time budget ended the sweep before the queue was empty. */
  budgetExhausted: boolean;
}

/**
 * Sweep of expired PENDING_PAYMENT bookings.
 *
 * Oldest first (`expiresAt` asc), page after page UNTIL THE QUEUE IS EMPTY
 * or the time budget is spent. The previous shape took one unordered page
 * of 100: rows it deliberately skips (paid / settling sessions) could fill
 * that page and starve every other expired booking forever. Rows already
 * looked at in this run are excluded from the next page, so a skipped row
 * costs one look per run, never the window.
 */
export async function expirePendingPaymentBookings(
  now = new Date(),
  options?: { budgetMs?: number; batchSize?: number }
): Promise<ExpirePendingBookingsResult> {
  const budgetMs = options?.budgetMs ?? SWEEP_DEFAULT_BUDGET_MS;
  const batchSize = options?.batchSize ?? SWEEP_BATCH_SIZE;
  const deadline = Date.now() + budgetMs;

  let expired = 0;
  let deletedHolds = 0;
  let failed = 0;
  let skipped = 0;
  let budgetExhausted = false;
  const seenIds = new Set<string>();

  sweep: for (;;) {
    if (Date.now() >= deadline) {
      budgetExhausted = true;
      break;
    }
    const candidates = await db.booking.findMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        // The booking's own expiry is authoritative (P-04 / L-050): a hold
        // claimed at submit lives until its Stripe session expiry, up to
        // createdAt + 40 min — a createdAt cutoff would cancel bookings
        // MID-PAYMENT. Legacy rows without expiresAt fall back to createdAt.
        OR: [
          { expiresAt: { lt: now } },
          {
            expiresAt: null,
            createdAt: { lt: addMinutes(now, -PAYMENT_EXPIRATION_MINUTES) },
          },
        ],
        ...(seenIds.size > 0 ? { id: { notIn: Array.from(seenIds) } } : {}),
      },
      select: {
        id: true,
        reference: true,
        visitorEmail: true,
        visitorName: true,
        locale: true,
        createdAt: true,
        expiresAt: true,
        stripeCheckoutSessionId: true,
        date: true,
        experience: {
          select: {
            title: true,
            slug: true,
          },
        },
      },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
      take: batchSize,
    });
    // Only rows not looked at yet in this run. A page with nothing new ends
    // the sweep — the loop can never spin on rows it already handled.
    const fresh = candidates.filter((candidate) => !seenIds.has(candidate.id));
    if (fresh.length === 0) break;

    for (const candidate of fresh) {
      if (Date.now() >= deadline) {
        budgetExhausted = true;
        break sweep;
      }
      seenIds.add(candidate.id);
      const outcome = await expireCandidate(candidate, now);
      if (outcome === 'expired') expired++;
      else if (outcome === 'deleted_hold') deletedHolds++;
      else if (outcome === 'failed') failed++;
      else skipped++;
    }
  }

  logInfo('booking.pending_payment.expired', {
    expired,
    deletedHolds,
    failed,
    skipped,
    budgetExhausted,
  });
  return { expired, deletedHolds, failed, skipped, budgetExhausted };
}

interface ExpirationCandidate {
  id: string;
  reference: string;
  visitorEmail: string;
  visitorName: string;
  locale: Parameters<typeof sendBookingExpiredEmail>[2];
  createdAt: Date;
  expiresAt: Date | null;
  stripeCheckoutSessionId: string | null;
  date: Date;
  experience: { title: string; slug: string };
}

async function expireCandidate(
  candidate: ExpirationCandidate,
  now: Date
): Promise<'expired' | 'deleted_hold' | 'skipped' | 'failed'> {
  const isPastDeadline = candidate.expiresAt
    ? isBefore(candidate.expiresAt, now)
    : isBefore(addMinutes(candidate.createdAt, 30), now);
  if (!isPastDeadline) return 'skipped';

  try {
    // Unclaimed hold (placeholder visitor, no Stripe session): not a
    // real booking — delete the row. No cancellation status, no email
    // (the sentinel address would hard-bounce and poison the winery's
    // cancellation stats).
    if (
      isHoldPlaceholderEmail(candidate.visitorEmail) &&
      !candidate.stripeCheckoutSessionId
    ) {
      const deleted = await db.booking.deleteMany({
        where: {
          id: candidate.id,
          status: BookingStatus.PENDING_PAYMENT,
          stripeCheckoutSessionId: null,
        },
      });
      return deleted.count === 1 ? 'deleted_hold' : 'skipped';
    }

    // Ask Stripe BEFORE cancelling: a paid session whose
    // checkout.session.completed webhook is late must NOT be expired
    // locally — the webhook will confirm it. Cancelling first would
    // strand a captured payment on a cancelled booking.
    if (candidate.stripeCheckoutSessionId?.startsWith('cs_')) {
      let checkoutSession;
      try {
        checkoutSession = await getStripe().checkout.sessions.retrieve(
          candidate.stripeCheckoutSessionId
        );
      } catch (error) {
        logWarn('Could not retrieve Checkout Session — retrying next run', {
          action: 'expirePendingPaymentBookings',
          bookingId: candidate.id,
          error: String(error),
        });
        return 'skipped';
      }
      if (
        checkoutSession.payment_status !== 'unpaid' ||
        checkoutSession.status === 'complete'
      ) {
        // Paid, or completed-and-settling (e.g. delayed TWINT): never cancel
        // here — a genuinely FAILED async payment also reports status
        // 'complete' + unpaid, indistinguishable from "still settling" by
        // session state alone, so this cron intentionally leaves BOTH cases
        // alone. The checkout webhook's `async_payment_failed` handler is
        // the one that resolves the failed case (P-16 review finding) —
        // without it, this clause would strand the booking PENDING forever.
        logWarn(
          'Session paid or settling but booking still pending — leaving to webhook',
          {
            action: 'expirePendingPaymentBookings',
            bookingId: candidate.id,
            paymentStatus: checkoutSession.payment_status,
            sessionStatus: checkoutSession.status,
          }
        );
        // "Leaving to the webhook" is only right while the webhook can
        // still come: PAID and still pending long after the window closed
        // means the confirmation event was lost — a client charged with
        // no ticket. Alert (every run, until someone replays the event).
        const windowClosedAt =
          candidate.expiresAt ?? addMinutes(candidate.createdAt, 30);
        if (
          checkoutSession.payment_status === 'paid' &&
          isBefore(
            addMinutes(windowClosedAt, PAID_BUT_PENDING_ALERT_MINUTES),
            now
          )
        ) {
          Sentry.captureMessage(
            'paid checkout session, booking still pending',
            {
              level: 'error',
              tags: { area: 'stripe-webhook', incident: 'paid-pending' },
              extra: {
                bookingId: candidate.id,
                bookingRef: candidate.reference,
                sessionId: candidate.stripeCheckoutSessionId,
              },
            }
          );
        }
        return 'skipped';
      }
    }

    // Atomic CAS: only cancel a booking STILL pending payment — a webhook
    // confirmation landing between the Stripe check and here must win the
    // row instead of being clobbered back to CANCELLED. The gift release
    // (P-09) rides the SAME transaction: once the row is CANCELLED nothing
    // else returns its reserved gift (the expiry webhook sees a non-pending
    // booking), so a failure between the two stranded the redemption.
    const claimed = await db.$transaction(async (tx) => {
      const result = await tx.booking.updateMany({
        where: { id: candidate.id, status: BookingStatus.PENDING_PAYMENT },
        data: {
          status: BookingStatus.CANCELLED_BY_CLIENT,
          cancelledAt: now,
          cancellationReason: 'PAYMENT_EXPIRED',
        },
      });
      if (result.count === 0) return false;
      await releaseGiftForBookingInTx(tx, candidate.id);
      return true;
    });

    if (!claimed) return 'skipped';

    if (candidate.stripeCheckoutSessionId?.startsWith('cs_')) {
      try {
        await getStripe().checkout.sessions.expire(
          candidate.stripeCheckoutSessionId
        );
      } catch (error) {
        logWarn('Failed to expire Stripe Checkout session', {
          action: 'expirePendingPaymentBookings',
          bookingId: candidate.id,
          error: String(error),
        });
      }
    }

    // Never email a hold placeholder address (guaranteed bounce).
    if (!isHoldPlaceholderEmail(candidate.visitorEmail)) {
      await sendBookingExpiredEmail(
        candidate.visitorEmail,
        {
          guestName: candidate.visitorName,
          experienceTitle: candidate.experience.title,
          experienceSlug: candidate.experience.slug,
          date: candidate.date,
        },
        candidate.locale
      );
    }
    return 'expired';
  } catch (error) {
    logError('Failed to expire pending booking', error, {
      action: 'expirePendingPaymentBookings',
      bookingId: candidate.id,
    });
    return 'failed';
  }
}

export interface BookingMaintenanceResult extends ExpirePendingBookingsResult {
  /** Cancellations whose refund never completed, newly alerted this run. */
  stuckRefundsFlagged: number;
}

/**
 * Everything the periodic booking sweep does, in one callable: expire dead
 * pending bookings, then flag cancellations whose refund never completed
 * (crash-recovery marker, booking-refund.service). Called by its own cron
 * route AND from the 3-hourly scheduled-jobs slots, so a hold that slipped
 * past its expiry webhook is cleaned within hours, not at 03:00.
 * Concurrent runs are safe: every transition is a compare-and-swap.
 */
export async function runBookingMaintenanceSweep(options?: {
  now?: Date;
  budgetMs?: number;
}): Promise<BookingMaintenanceResult> {
  const now = options?.now ?? new Date();
  const expiration = await expirePendingPaymentBookings(now, {
    budgetMs: options?.budgetMs,
  });
  let stuckRefundsFlagged = 0;
  try {
    stuckRefundsFlagged = await flagStuckCancellationRefunds(now);
  } catch (error) {
    logError('stuck cancellation refund sweep failed', error, {
      action: 'runBookingMaintenanceSweep',
    });
  }
  return { ...expiration, stuckRefundsFlagged };
}
