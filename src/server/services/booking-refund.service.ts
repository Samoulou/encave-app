import * as Sentry from '@sentry/nextjs';
import { db } from '@/server/db';
import { processRefund } from '@/server/services/payment.service';
import { releaseGiftForBooking } from '@/server/services/giftCard-redemption.service';
import { reverseGiftTransferForCancellation } from '@/server/services/giftCard-transfer.service';
import { splitRefundBetweenCardAndGift } from '@/lib/business-rules/cancellation-policy';
import { logError, logInfo } from '@/lib/logger';

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
}

export async function processCancellationRefund(
  input: CancellationRefundInput
): Promise<CancellationRefundOutcome> {
  const none: CancellationRefundOutcome = {
    cardRefundCents: null,
    stripeRefundId: null,
    giftRestoredCents: 0,
    totalReturnedCents: 0,
  };
  if (input.refundDueCents <= 0) return none;

  // ── Classic booking: single refund on the destination charge. ──────────
  if (input.giftAppliedCents <= 0) {
    if (!input.stripePaymentIntentId) return none;
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
        note: 'cancellation_refund',
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
      `GIFT_REVERSAL_FAILED: winery transfer not reversed after cancellation — reverse manually in Stripe (runbook incident-paiement)`
    );
  }

  return {
    cardRefundCents: issuedCardCents,
    stripeRefundId,
    giftRestoredCents,
    totalReturnedCents: (issuedCardCents ?? 0) + giftRestoredCents,
  };
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
    const current = await db.booking.findUnique({
      where: { id: bookingId },
      select: { refundError: true },
    });
    const next = current?.refundError
      ? `${current.refundError} | ${message}`
      : message;
    await db.booking.update({
      where: { id: bookingId },
      data: { refundError: next },
    });
  } catch (error) {
    // Last resort: the Pino log above is the only trace left.
    logError('failed to persist refundError', error, {
      action: 'appendRefundError',
      bookingId,
    });
  }
}
