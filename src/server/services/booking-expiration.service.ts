import { addMinutes, isBefore } from 'date-fns';
import { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import { getStripe } from '@/server/stripe';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { isHoldPlaceholderEmail } from '@/lib/constants/booking-hold';
import { sendBookingExpiredEmail } from '@/server/services/email.service';
import { releaseGiftForBooking } from '@/server/services/giftCard-redemption.service';

/**
 * Fallback for legacy rows without an expiresAt — every current creation
 * path sets one, so this only guards hand-inserted data.
 */
const PAYMENT_EXPIRATION_MINUTES = 30;

export async function expirePendingPaymentBookings(now = new Date()): Promise<{
  expired: number;
  deletedHolds: number;
  /** Candidates whose expiration threw (P-16 review: surfaced, not hidden). */
  failed: number;
}> {
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
    },
    select: {
      id: true,
      reference: true,
      visitorEmail: true,
      visitorName: true,
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
    take: 100,
  });

  let expired = 0;
  let deletedHolds = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const isPastDeadline = candidate.expiresAt
      ? isBefore(candidate.expiresAt, now)
      : isBefore(addMinutes(candidate.createdAt, 30), now);
    if (!isPastDeadline) continue;

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
        if (deleted.count === 1) deletedHolds++;
        continue;
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
          continue;
        }
        if (checkoutSession.payment_status !== 'unpaid') {
          logWarn(
            'Session paid but booking still pending — leaving to webhook',
            {
              action: 'expirePendingPaymentBookings',
              bookingId: candidate.id,
              paymentStatus: checkoutSession.payment_status,
            }
          );
          continue;
        }
      }

      const updated = await db.$transaction(async (tx) => {
        const current = await tx.booking.findUnique({
          where: { id: candidate.id },
          select: { status: true },
        });

        if (!current || current.status !== BookingStatus.PENDING_PAYMENT) {
          return false;
        }

        await tx.booking.update({
          where: { id: candidate.id },
          data: {
            status: BookingStatus.CANCELLED_BY_CLIENT,
            cancelledAt: now,
            cancellationReason: 'PAYMENT_EXPIRED',
          },
        });
        return true;
      });

      if (!updated) continue;

      // Return any gift-card funds reserved on this now-cancelled booking
      // (P-09) — idempotent, no-op without a gift. The expiry webhook won't
      // do it (the booking is no longer PENDING_PAYMENT here).
      await releaseGiftForBooking(candidate.id);

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
        await sendBookingExpiredEmail(candidate.visitorEmail, {
          guestName: candidate.visitorName,
          experienceTitle: candidate.experience.title,
          experienceSlug: candidate.experience.slug,
          date: candidate.date,
        });
      }
      expired++;
    } catch (error) {
      failed++;
      logError('Failed to expire pending booking', error, {
        action: 'expirePendingPaymentBookings',
        bookingId: candidate.id,
      });
    }
  }

  logInfo('booking.pending_payment.expired', { expired, deletedHolds, failed });
  return { expired, deletedHolds, failed };
}
