import * as Sentry from '@sentry/nextjs';
import type { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import { getStripe } from '@/server/stripe';
import { processRefund } from '@/server/services/payment.service';
import {
  GIFT_CANCELLATION_REFUND_NOTE,
  releaseGiftForBooking,
} from '@/server/services/giftCard-redemption.service';
import { reverseGiftTransferForCancellation } from '@/server/services/giftCard-transfer.service';
import { splitRefundBetweenCardAndGift } from '@/lib/business-rules/cancellation-policy';
import { logError, logInfo, logWarn } from '@/lib/logger';

/**
 * Cancellation refund orchestration (P-16 / WS-A.3, ADR-0003) — the ONE
 * place that knows a gift-funded booking refunds in three movements:
 * card refund (platform charge, no reverse_transfer), gift-balance
 * restoration (ledger REFUND), winery transfer reversal. Classic bookings
 * keep the historical single destination-charge refund.
 *
 * Contract with the callers (cancelBooking / cancelClientBooking /
 * cancelEventSession):
 *  - a CARD refund failure THROWS the raw Stripe error — the action keeps
 *    its deterministic-vs-ambiguous claim-release semantics;
 *  - gift restoration and transfer reversal failures NEVER throw: the
 *    client's money already moved, so they are logged, pushed to Sentry
 *    and appended to `Booking.refundError` for manual reconciliation.
 */

/**
 * True when the booking never carried ANY online money: no card charge
 * (payment intent) and no gift redemption — an ON_SITE / free offer settled
 * at the winery (P-08). Such a booking has nothing to refund: the price on
 * the row is what the guest would have paid at the cave, not a payment.
 * Without this, every ON_SITE cancellation computed a refund "due" on that
 * price and raised a false CARD_REFUND_IMPOSSIBLE incident (Sentry +
 * refundError) plus a "refund pending" email.
 *
 * Decided on the booking's OWN facts, not the experience's current
 * paymentMode (which the winery may have switched since): an on-site
 * booking has either no Checkout Session at all (no imprint) or a
 * setup-mode one (card imprint → noShowSetupIntentId). A booking that went
 * through a PAYMENT session but lost its payment intent is NOT matched —
 * that is the genuine data anomaly the incident marker exists for.
 */
export function wasNeverChargedOnline(booking: {
  stripePaymentIntentId: string | null;
  giftAppliedCents: number;
  stripeCheckoutSessionId: string | null;
  noShowSetupIntentId: string | null;
}): boolean {
  if (booking.stripePaymentIntentId || booking.giftAppliedCents > 0) {
    return false;
  }
  return (
    !booking.stripeCheckoutSessionId || Boolean(booking.noShowSetupIntentId)
  );
}

export interface CancellationRefundInput {
  bookingId: string;
  stripePaymentIntentId: string | null;
  giftAppliedCents: number;
  wineryPayout: number;
  /** Owed by the policy, net of prior refunds (computeBookingRefund). */
  refundDueCents: number;
  alreadyRefundedCents: number;
  /** Full paid amount (tickets + service fee). */
  paidCents: number;
  /**
   * Winery clawback for this cancellation, computed by the caller with
   * computeRefundCents(policy, hoursUntilStart, wineryPayout) — the ONE
   * rounding rule shared with the client refund (review #120).
   */
  reversalCents: number;
  /** Log context: 'cancelBooking' | 'cancelClientBooking' | …. */
  actionName: string;
}

export interface CancellationRefundOutcome {
  /** Stripe card refund actually issued, null when none was performed. */
  cardRefundCents: number | null;
  stripeRefundId: string | null;
  /** Gift balance restored onto the card (ledger REFUND). */
  giftRestoredCents: number;
  /** Client-facing total returned: card + gift. */
  totalReturnedCents: number;
  /**
   * Card money Stripe had ALREADY refunded on this payment that
   * `Booking.refundAmount` did not know about (a Stripe Dashboard refund
   * whose `charge.refunded` sync never landed). 0 in the normal case. The
   * ledger write must add it — see {@link recordCancellationRefund}.
   */
  ledgerDriftCents: number;
}

const NO_REFUND: CancellationRefundOutcome = {
  cardRefundCents: null,
  stripeRefundId: null,
  giftRestoredCents: 0,
  totalReturnedCents: 0,
  ledgerDriftCents: 0,
};

/**
 * Card refunds Stripe holds for a payment (succeeded or still pending) —
 * the truth `Booking.refundAmount` is supposed to mirror.
 */
async function sumStripeRefundedCents(
  paymentIntentId: string
): Promise<number> {
  const refunds = await getStripe().refunds.list({
    payment_intent: paymentIntentId,
    limit: 100,
  });
  return refunds.data
    .filter(
      (refund) => refund.status !== 'failed' && refund.status !== 'canceled'
    )
    .reduce((sum, refund) => sum + refund.amount, 0);
}

function isStripeInvalidRequest(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'StripeInvalidRequestError'
  );
}

/**
 * Cancellation refund, tolerant of money Stripe already returned.
 *
 * `refundDueCents` is derived from `Booking.refundAmount`. When a refund
 * was made from the Stripe Dashboard and never synced, that figure is
 * stale: the card refund asks for more than the charge has left, Stripe
 * rejects it deterministically, the caller releases its claim — and the
 * booking can never be cancelled again. On such a rejection we ask Stripe
 * what it already refunded; if it holds MORE than the ledger knew, the due
 * amount is recomputed against that truth and only the rest is refunded.
 * Any other rejection is rethrown untouched (caller semantics unchanged).
 */
export async function processCancellationRefund(
  input: CancellationRefundInput
): Promise<CancellationRefundOutcome> {
  if (input.refundDueCents <= 0) return NO_REFUND;
  try {
    return await executeCancellationRefund(input);
  } catch (error) {
    // Only the FIRST movement (the card refund) can throw, so nothing has
    // moved yet when we get here — a recomputed second attempt is safe.
    const paymentIntentId = input.stripePaymentIntentId;
    if (
      !isStripeInvalidRequest(error) ||
      !paymentIntentId ||
      !paymentIntentId.startsWith('pi_')
    ) {
      throw error;
    }
    let stripeRefundedCents: number;
    try {
      stripeRefundedCents = await sumStripeRefundedCents(paymentIntentId);
    } catch (listError) {
      logError('Could not read Stripe refunds after a rejection', listError, {
        action: input.actionName,
        bookingId: input.bookingId,
      });
      throw error;
    }
    const ledgerDriftCents = stripeRefundedCents - input.alreadyRefundedCents;
    if (ledgerDriftCents <= 0) throw error; // not a drift — genuine rejection

    const policyDueCents = input.refundDueCents + input.alreadyRefundedCents;
    const remainingDueCents = Math.max(0, policyDueCents - stripeRefundedCents);
    logWarn('Stripe already refunded more than the ledger knew', {
      action: input.actionName,
      bookingId: input.bookingId,
      stripeRefundedCents,
      ledgerRefundedCents: input.alreadyRefundedCents,
      remainingDueCents,
    });
    Sentry.captureMessage('refund ledger drift reconciled on cancellation', {
      level: 'warning',
      tags: { area: 'gift-refund', incident: 'refund-ledger-drift' },
      extra: {
        bookingId: input.bookingId,
        stripeRefundedCents,
        ledgerRefundedCents: input.alreadyRefundedCents,
        remainingDueCents,
      },
    });
    await appendRefundError(
      input.bookingId,
      `STRIPE_REFUND_DRIFT: Stripe already held ${stripeRefundedCents} cents refunded (ledger knew ${input.alreadyRefundedCents}) — cancellation refunded the remaining ${remainingDueCents} only`
    );
    if (remainingDueCents <= 0) {
      return { ...NO_REFUND, ledgerDriftCents };
    }
    const outcome = await executeCancellationRefund({
      ...input,
      refundDueCents: remainingDueCents,
      alreadyRefundedCents: stripeRefundedCents,
    });
    return { ...outcome, ledgerDriftCents };
  }
}

async function executeCancellationRefund(
  input: CancellationRefundInput
): Promise<CancellationRefundOutcome> {
  const none = NO_REFUND;

  // ── Classic booking: single refund on the destination charge. ──────────
  if (input.giftAppliedCents <= 0) {
    if (!input.stripePaymentIntentId) {
      // Money is owed but no charge is on file — same anomaly as the gift
      // branch, same persisted marker (review #120 sweep: this return was
      // the service's only silent one).
      logError(
        'Refund due but no payment intent on classic booking',
        undefined,
        {
          action: input.actionName,
          bookingId: input.bookingId,
          refundDueCents: input.refundDueCents,
        }
      );
      Sentry.captureMessage('card refund impossible: no payment intent', {
        level: 'error',
        tags: { area: 'gift-refund' },
        extra: {
          bookingId: input.bookingId,
          refundDueCents: input.refundDueCents,
        },
      });
      await appendRefundError(
        input.bookingId,
        `CARD_REFUND_IMPOSSIBLE: ${input.refundDueCents} cents of refund due but no payment intent on file — reconcile manually`
      );
      return none;
    }
    const refund = await processRefund(
      input.stripePaymentIntentId,
      true,
      input.refundDueCents,
      `cancel-refund:${input.bookingId}:${input.refundDueCents}`
    );
    return {
      cardRefundCents: refund.amount,
      stripeRefundId: refund.refundId,
      giftRestoredCents: 0,
      totalReturnedCents: refund.amount,
      ledgerDriftCents: 0,
    };
  }

  // ── Gift-funded booking (ADR-0003): three movements. ────────────────────
  const cardPaidCents = input.paidCents - input.giftAppliedCents;
  const { cardRefundCents, giftRestoreCents } = splitRefundBetweenCardAndGift({
    refundDueCents: input.refundDueCents,
    cardPaidCents,
    giftAppliedCents: input.giftAppliedCents,
    alreadyRefundedCents: input.alreadyRefundedCents,
  });

  let issuedCardCents: number | null = null;
  let stripeRefundId: string | null = null;
  if (cardRefundCents > 0) {
    if (input.stripePaymentIntentId) {
      // Platform charge: no transfer to reverse, no application fee.
      const refund = await processRefund(
        input.stripePaymentIntentId,
        false,
        cardRefundCents,
        `cancel-refund:${input.bookingId}:${cardRefundCents}`,
        { reverseTransfer: false }
      );
      issuedCardCents = refund.amount;
      stripeRefundId = refund.refundId;
    } else {
      // Card money is due but no charge is on file — data anomaly. The
      // gift movements below still proceed; the gap is persisted so it
      // cannot vanish behind a partially-successful outcome (review #120).
      logError(
        'Card refund due but no payment intent on gift-funded booking',
        undefined,
        {
          action: input.actionName,
          bookingId: input.bookingId,
          cardRefundCents,
        }
      );
      Sentry.captureMessage('card refund impossible: no payment intent', {
        level: 'error',
        tags: { area: 'gift-refund' },
        extra: { bookingId: input.bookingId, cardRefundCents },
      });
      await appendRefundError(
        input.bookingId,
        `CARD_REFUND_IMPOSSIBLE: ${cardRefundCents} cents of card refund due but no payment intent on file — reconcile manually`
      );
    }
  }

  // Compensations — post-refund, non-blocking (ADR-0003).
  let giftRestoredCents = 0;
  try {
    if (giftRestoreCents > 0) {
      const outcome = await releaseGiftForBooking(input.bookingId, {
        amountCents: giftRestoreCents,
        note: GIFT_CANCELLATION_REFUND_NOTE,
      });
      if (outcome === 'refunded') giftRestoredCents = giftRestoreCents;
      logInfo('gift balance restored on cancellation', {
        action: input.actionName,
        bookingId: input.bookingId,
        giftRestoreCents,
        outcome,
      });
    }
  } catch (error) {
    logError('gift balance restoration failed on cancellation', error, {
      action: input.actionName,
      bookingId: input.bookingId,
      giftRestoreCents,
    });
    Sentry.captureException(error, {
      tags: { area: 'gift-refund' },
      extra: { bookingId: input.bookingId, giftRestoreCents },
    });
    await appendRefundError(
      input.bookingId,
      `GIFT_RESTORE_FAILED: ${giftRestoreCents} cents to restore for cancelled booking — reconcile ledger manually`
    );
  }

  try {
    const outcome = await reverseGiftTransferForCancellation(
      input.bookingId,
      input.reversalCents
    );
    // Partial-refund cancellation whose winery transfer never settled:
    // the reversal has nothing to claw back, but the winery is OWED the
    // non-refunded share and no cron will ever pay it (settle + reconcile
    // only touch CONFIRMED bookings) — surface it (review #120).
    if (
      outcome === 'no-transfer' &&
      input.reversalCents > 0 &&
      input.reversalCents < input.wineryPayout
    ) {
      Sentry.captureMessage(
        'gift payout never settled on partially-refunded cancellation',
        {
          level: 'warning',
          tags: { area: 'gift-refund' },
          extra: {
            bookingId: input.bookingId,
            wineryShareCents: input.wineryPayout - input.reversalCents,
          },
        }
      );
      await appendRefundError(
        input.bookingId,
        `GIFT_SETTLE_SKIPPED: winery share of ${input.wineryPayout - input.reversalCents} cents was never transferred and no cron will retry a cancelled booking — pay manually (runbook incident-paiement)`
      );
    }
  } catch (error) {
    logError('gift transfer reversal failed on cancellation', error, {
      action: input.actionName,
      bookingId: input.bookingId,
    });
    Sentry.captureException(error, {
      tags: { area: 'gift-refund' },
      extra: { bookingId: input.bookingId },
    });
    await appendRefundError(
      input.bookingId,
      // "may or may not": the throw can also come from the DB write AFTER
      // a successful Stripe reversal (review #120 workflow) — the operator
      // must check Stripe before reversing manually, or risk doubling it.
      `GIFT_REVERSAL_FAILED: winery transfer reversal errored after cancellation — the reversal may or may not have reached Stripe: VERIFY the transfer in Stripe before reversing manually (runbook incident-paiement)`
    );
  }

  return {
    cardRefundCents: issuedCardCents,
    stripeRefundId,
    giftRestoredCents,
    totalReturnedCents: (issuedCardCents ?? 0) + giftRestoredCents,
    ledgerDriftCents: 0,
  };
}

/**
 * Persist what a cancellation returned on `Booking.refundAmount` — the ONE
 * ledger write shared by cancelBooking / cancelClientBooking /
 * cancelEventSession.
 *
 * Conditional on the `refundAmount` the caller READ: a concurrent refund
 * writer must not be clobbered. Two concurrent writers are legitimate and
 * recognised instead of being flagged:
 *  - the `charge.refunded` webhook, which syncs our OWN card refund before
 *    we get here (its value is exactly "read + drift + card refund");
 *  - anything that already recorded at least our total.
 * Everything else is a real conflict: the DB value is kept and a
 * LEDGER_CONFLICT marker is appended for reconciliation.
 */
export async function recordCancellationRefund(input: {
  bookingId: string;
  /** `Booking.refundAmount` as read before the cancellation. */
  readRefundAmount: number | null;
  outcome: CancellationRefundOutcome;
  actionName: string;
}): Promise<void> {
  const { bookingId, readRefundAmount, outcome, actionName } = input;
  const returnedCents = outcome.ledgerDriftCents + outcome.totalReturnedCents;
  if (returnedCents <= 0) return;

  const baseCents = readRefundAmount ?? 0;
  const targetCents = baseCents + returnedCents;
  const data = {
    refundIssued: true,
    refundAmount: targetCents,
    // A gift-only restitution has no Stripe refund — never null out a re_
    // written by an earlier admin refund (review #120).
    ...(outcome.stripeRefundId
      ? { stripeRefundId: outcome.stripeRefundId }
      : {}),
  };

  const recorded = await db.booking.updateMany({
    where: { id: bookingId, refundAmount: readRefundAmount },
    data,
  });
  if (recorded.count === 1) return;

  const current = await db.booking.findUnique({
    where: { id: bookingId },
    select: { refundAmount: true },
  });
  const currentCents = current?.refundAmount ?? 0;
  const webhookSyncedCents =
    baseCents + outcome.ledgerDriftCents + (outcome.cardRefundCents ?? 0);
  if (currentCents >= targetCents || currentCents === webhookSyncedCents) {
    // The webhook sync got there first — complete it (never lower it).
    await db.booking.updateMany({
      where: { id: bookingId, refundAmount: current?.refundAmount ?? null },
      data: { ...data, refundAmount: Math.max(currentCents, targetCents) },
    });
    return;
  }

  logWarn('Refund ledger conflict — concurrent refund writer', {
    action: actionName,
    bookingId,
    cancelRefundCents: outcome.totalReturnedCents,
    stripeRefundId: outcome.stripeRefundId,
  });
  await appendRefundError(
    bookingId,
    `LEDGER_CONFLICT: cancellation returned ${outcome.totalReturnedCents} (${outcome.stripeRefundId ?? 'gift only'}) concurrently with another refund writer — reconcile with Stripe`
  );
}

/**
 * Mirror a Stripe-side refund total onto the booking (`charge.refunded`
 * webhook — a refund issued from the Stripe Dashboard, or the echo of our
 * own). MONOTONIC: only ever raises `refundAmount`, so a late or replayed
 * event can never erase a refund the app recorded, and an event for a
 * refund the app already knows is a no-op. `refundAmount` is the TOTAL
 * returned (card + restored gift balance, ADR-0003): the gift part comes
 * from the ledger.
 */
export async function syncBookingRefundFromStripe(input: {
  bookingId: string;
  /** Stripe `charge.amount_refunded` — cumulative card refunds. */
  cardRefundedCents: number;
}): Promise<'synced' | 'noop'> {
  if (input.cardRefundedCents <= 0) return 'noop';
  const giftRestored = await db.giftCardTransaction.aggregate({
    where: {
      bookingId: input.bookingId,
      type: 'REFUND',
      note: GIFT_CANCELLATION_REFUND_NOTE,
    },
    _sum: { amount: true },
  });
  const targetCents = input.cardRefundedCents + (giftRestored._sum.amount ?? 0);
  const updated = await db.$executeRaw`
    UPDATE bookings
    SET "refundAmount" = ${targetCents}, "refundIssued" = true
    WHERE id = ${input.bookingId}
      AND COALESCE("refundAmount", 0) < ${targetCents}
  `;
  return updated > 0 ? 'synced' : 'noop';
}

/* ───────────── cancellation claim + crash-recovery marker ───────────── */

/** A refund is owed and its processing has not finished (or crashed). */
export const CANCEL_REFUND_PENDING_PREFIX = 'CANCEL_REFUND_PENDING';
/** Same marker once the sweep found it stale and alerted (ops must act). */
export const CANCEL_REFUND_STUCK_PREFIX = 'CANCEL_REFUND_STUCK';

function cancelRefundMarker(prefix: string, refundDueCents: number): string {
  return `${prefix}(${refundDueCents})`;
}

/**
 * Atomic cancellation claim (the status flip IS the lock against a double
 * refund) that ALSO records, in the same transaction, that a refund is owed.
 *
 * The claim used to be a bare status update: a crash between it and the
 * refund (function timeout, deploy, OOM) left a CANCELLED booking with no
 * refund and NO trace — nothing retries a cancelled booking. The
 * `CANCEL_REFUND_PENDING(<cents>)` marker in `refundError` is that trace:
 * cleared by {@link clearCancellationRefundMarker} when the flow ends, it
 * survives only a crash, where the expiry sweep turns it into an alert.
 */
export async function claimBookingCancellation(input: {
  bookingId: string;
  from: BookingStatus;
  to: BookingStatus;
  cancellationReason?: string;
  refundDueCents: number;
}): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const claimed = await tx.booking.updateMany({
      where: { id: input.bookingId, status: input.from },
      data: {
        status: input.to,
        cancelledAt: new Date(),
        ...(input.cancellationReason !== undefined
          ? { cancellationReason: input.cancellationReason }
          : {}),
      },
    });
    if (claimed.count !== 1) return false;
    if (input.refundDueCents > 0) {
      const marker = cancelRefundMarker(
        CANCEL_REFUND_PENDING_PREFIX,
        input.refundDueCents
      );
      await tx.$executeRaw`
        UPDATE bookings
        SET "refundError" = COALESCE("refundError" || ' | ', '') || ${marker}
        WHERE id = ${input.bookingId}
      `;
    }
    return true;
  });
}

/**
 * Remove the pending/stuck marker once the refund flow reached an END
 * state (refunded, claim released, or a specific reconciliation marker
 * appended). Other markers in `refundError` are preserved. A failure here
 * leaves the marker — the sweep then raises a (safe-side) alert.
 *
 * `refundDueCents` is only a shortcut: pass the amount the claim was made
 * with to skip the query when no marker was ever written (0 due). Omit it
 * to clear unconditionally (resumed bookings: the marker carries the amount
 * of the ORIGINAL claim, not today's remaining due).
 */
export async function clearCancellationRefundMarker(
  bookingId: string,
  refundDueCents?: number
): Promise<void> {
  if (refundDueCents !== undefined && refundDueCents <= 0) return;
  try {
    // Character classes instead of backslash escapes: the pattern travels
    // through a JS template literal AND a SQL string literal.
    await db.$executeRaw`
      UPDATE bookings
      SET "refundError" = NULLIF(
        regexp_replace(
          regexp_replace(
            "refundError",
            '( [|] )?CANCEL_REFUND_(PENDING|STUCK)[(][0-9]+[)]',
            '',
            'g'
          ),
          '^ [|] ',
          ''
        ),
        ''
      )
      WHERE id = ${bookingId}
        AND "refundError" ~ 'CANCEL_REFUND_(PENDING|STUCK)[(]'
    `;
  } catch (error) {
    logError('failed to clear the cancellation refund marker', error, {
      action: 'clearCancellationRefundMarker',
      bookingId,
    });
  }
}

/**
 * Crash-recovery sweep: a `CANCEL_REFUND_PENDING` marker older than the
 * grace period means the cancellation died between its claim and the end
 * of its refund. Alert once (Sentry, area:gift-refund) and re-label the
 * marker STUCK so the next pass does not alert again; the booking stays
 * findable (refundError) for the incident-paiement runbook. The refund is
 * NOT replayed automatically: past Stripe's 24 h idempotency window a
 * blind retry could refund twice.
 */
export async function flagStuckCancellationRefunds(
  now: Date = new Date(),
  graceMinutes = 15
): Promise<number> {
  const staleBefore = new Date(now.getTime() - graceMinutes * 60 * 1000);
  const stuck = await db.booking.findMany({
    where: {
      refundError: { contains: `${CANCEL_REFUND_PENDING_PREFIX}(` },
      cancelledAt: { lt: staleBefore },
    },
    select: { id: true, reference: true, refundError: true },
    orderBy: { cancelledAt: 'asc' },
    take: 50,
  });
  for (const booking of stuck) {
    logError('Cancellation refund never completed', undefined, {
      action: 'flagStuckCancellationRefunds',
      bookingId: booking.id,
      bookingRef: booking.reference,
    });
    Sentry.captureMessage('cancelled booking with an unfinished refund', {
      level: 'error',
      tags: { area: 'gift-refund', incident: 'cancel-refund-stuck' },
      extra: {
        bookingId: booking.id,
        bookingRef: booking.reference,
        refundError: booking.refundError,
      },
    });
    const pendingOpen = `${CANCEL_REFUND_PENDING_PREFIX}(`;
    const stuckOpen = `${CANCEL_REFUND_STUCK_PREFIX}(`;
    await db.$executeRaw`
      UPDATE bookings
      SET "refundError" = REPLACE("refundError", ${pendingOpen}, ${stuckOpen})
      WHERE id = ${booking.id}
    `;
  }
  return stuck.length;
}

/**
 * Append a reconciliation marker to `Booking.refundError` WITHOUT erasing
 * previous ones (review #120): a single cancellation can legitimately hit
 * several incidents (gift restore + reversal both failing) and the ops
 * runbook routes on these markers — last-write-wins lost the first debt.
 * Exported for the other refundError writers (actions, race reversal).
 */
export async function appendRefundError(
  bookingId: string,
  message: string
): Promise<void> {
  try {
    // Atomic DB-side concatenation (review #120 sweep): a read-modify-write
    // would re-introduce the lost-marker race between the webhook's race
    // branch and a concurrent cancellation writer.
    await db.$executeRaw`
      UPDATE bookings
      SET "refundError" = COALESCE("refundError" || ' | ', '') || ${message}
      WHERE id = ${bookingId}
    `;
  } catch (error) {
    // Last resort: the Pino log above is the only trace left.
    logError('failed to persist refundError', error, {
      action: 'appendRefundError',
      bookingId,
    });
  }
}
