import * as Sentry from '@sentry/nextjs';
import { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import { getStripe } from '@/server/stripe';
import { logError, logInfo } from '@/lib/logger';

/**
 * Platform→winery transfer of the gift-covered part of a booking (P-09,
 * Luca design §1/§2/§5). With separate charges & transfers, the winery
 * payout `P = wineryPayout` is deterministic and paid by ONE explicit
 * transfer, independent of the card charge. Idempotent on three levels:
 *  - `Booking.giftTransferId != null` → durable guard (survives redelivery),
 *  - Stripe idempotencyKey `gift_payout_{bookingId}`,
 *  - only CONFIRMED, gift-funded bookings are eligible.
 *
 * Called from the confirmation webhook, the card=0 inline path, and the
 * reconciliation cron. A Stripe failure throws → the caller decides (webhook
 * retries via StripeEvent; cron re-runs) — never swallow it silently.
 */
export async function settleGiftTransfer(
  bookingId: string
): Promise<'transferred' | 'noop' | 'skipped'> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      reference: true,
      status: true,
      giftAppliedCents: true,
      giftTransferId: true,
      wineryPayout: true,
      winery: { select: { stripeAccountId: true } },
    },
  });
  if (!booking) return 'noop';
  // Not a gift-funded booking, or the transfer already landed.
  if (booking.giftAppliedCents <= 0) return 'noop';
  if (booking.giftTransferId) return 'noop';
  // Only transfer once the client-side payment is confirmed (or card=0).
  if (booking.status !== BookingStatus.CONFIRMED) return 'skipped';

  const destination = booking.winery.stripeAccountId;
  if (!destination) {
    logError(
      'gift transfer skipped — winery has no Stripe account',
      undefined,
      {
        action: 'settleGiftTransfer',
        bookingId,
      }
    );
    return 'skipped';
  }
  const amount = booking.wineryPayout;
  if (amount <= 0) return 'noop';

  const transfer = await getStripe().transfers.create(
    {
      amount,
      currency: 'chf',
      destination,
      transfer_group: `booking_${bookingId}`,
      // The payout dashboard (P-13) must correlate the gift transfer via
      // this metadata, NOT via source_transaction (Luca escalation a).
      metadata: { bookingId, bookingReference: booking.reference },
    },
    { idempotencyKey: `gift_payout_${bookingId}` }
  );

  // Conditional write (P-16 / ADR-0003, Codex review): a cancellation can
  // claim the booking between our CONFIRMED read above and this write —
  // its reversal step would then see giftTransferId null and skip, leaving
  // the winery paid for a refunded booking. The status guard detects that
  // race so the transfer can be pulled back immediately.
  const recorded = await db.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.CONFIRMED,
      giftTransferId: null,
    },
    data: { giftTransferId: transfer.id },
  });

  if (recorded.count === 0) {
    const current = await db.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, giftTransferId: true },
    });
    // A concurrent settle raced us: Stripe's idempotency key collapsed
    // both calls into the SAME transfer — already recorded, nothing to do.
    if (current?.giftTransferId === transfer.id) return 'noop';

    // Mid-flight cancellation. The DURABLE marker is written BEFORE the
    // reversal call (review #120 sweep): if the reversal fails and Stripe
    // redelivers past the 24h idempotency window, a retry would mint a
    // SECOND transfer — this trace is what keeps tr_1 reconcilable. Then
    // reverse the whole transfer — platform-safe by default: on the rare
    // 0%-refund cancellation the winery's payout is re-issued manually
    // (runbook incident-paiement). Appended, never overwritten: the
    // concurrent cancellation may have just written its own markers.
    const { appendRefundError } =
      await import('@/server/services/booking-refund.service');
    await appendRefundError(
      bookingId,
      `GIFT_RACE_REVERSED: transfer ${transfer.id} settled against a mid-flight cancellation and is being fully reversed — VERIFY the reversal of ${transfer.id} in Stripe, and re-transfer manually if the policy left the payout to the winery (runbook incident-paiement)`
    );
    logError(
      'gift transfer settled against a mid-flight cancellation — fully reversed',
      undefined,
      { action: 'settleGiftTransfer', bookingId, transferId: transfer.id }
    );
    Sentry.captureMessage('gift transfer reversed after cancellation race', {
      level: 'warning',
      tags: { area: 'gift-transfer' },
      extra: { bookingId, transferId: transfer.id },
    });
    await getStripe().transfers.createReversal(
      transfer.id,
      { metadata: { bookingId, reason: 'settle_cancellation_race' } },
      { idempotencyKey: `gift_payout_race_reversal_${bookingId}` }
    );
    return 'skipped';
  }

  logInfo('gift_transfer.settled', {
    action: 'settleGiftTransfer',
    bookingId,
    amount,
    transferId: transfer.id,
  });
  return 'transferred';
}

/**
 * Reversal of the winery transfer when a gift-funded CONFIRMED booking is
 * cancelled (P-16 / WS-A.3, ADR-0003). Idempotent on two levels:
 *  - `Booking.giftTransferReversalId != null` → durable guard,
 *  - Stripe idempotencyKey `gift_reversal_{bookingId}`.
 * `reversalCents` is the policy-proportional clawback computed by the
 * caller, capped here at the transferred amount. No transfer settled yet
 * (`giftTransferId` null) → 'no-transfer', and none will ever settle:
 * settleGiftTransfer and the reconcile cron only touch CONFIRMED bookings
 * — the caller decides whether the winery is owed its share (review #120).
 * A Stripe failure throws — the caller logs and stores it for manual
 * reconciliation (runbook incident-paiement), never silently.
 */
export async function reverseGiftTransferForCancellation(
  bookingId: string,
  reversalCents: number
): Promise<'reversed' | 'noop' | 'no-transfer'> {
  if (reversalCents <= 0) return 'noop';
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      giftTransferId: true,
      giftTransferReversalId: true,
      wineryPayout: true,
    },
  });
  if (!booking?.giftTransferId) return 'no-transfer';
  if (booking.giftTransferReversalId) return 'noop';

  const amount = Math.min(reversalCents, booking.wineryPayout);
  if (amount <= 0) return 'noop';

  const reversal = await getStripe().transfers.createReversal(
    booking.giftTransferId,
    { amount, metadata: { bookingId, reason: 'booking_cancellation' } },
    { idempotencyKey: `gift_reversal_${bookingId}` }
  );

  await db.booking.update({
    where: { id: bookingId },
    data: { giftTransferReversalId: reversal.id },
  });

  logInfo('gift_transfer.reversed', {
    action: 'reverseGiftTransferForCancellation',
    bookingId,
    amount,
    transferId: booking.giftTransferId,
    reversalId: reversal.id,
  });
  return 'reversed';
}

/**
 * Reconciliation sweep (P-09, Luca §5/§8): retry the winery transfer for
 * CONFIRMED bookings whose gift transfer never landed (transient
 * balance_insufficient, a webhook that failed after confirmation, a KYC
 * hiccup). Idempotent via settleGiftTransfer's giftTransferId guard.
 */
export async function reconcileGiftTransfers(): Promise<{
  scanned: number;
  transferred: number;
  failed: number;
}> {
  const bookings = await db.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      giftAppliedCents: { gt: 0 },
      giftTransferId: null,
    },
    select: { id: true },
    take: 100,
  });
  let transferred = 0;
  let failed = 0;
  for (const booking of bookings) {
    try {
      const outcome = await settleGiftTransfer(booking.id);
      if (outcome === 'transferred') transferred++;
    } catch (error) {
      failed++;
      logError('gift transfer reconciliation failed for booking', error, {
        action: 'reconcileGiftTransfers',
        bookingId: booking.id,
      });
      // P-16 (WS-E): a transfer that still fails on the reconcile sweep is
      // a winery waiting for its money — alert, don't just count it.
      Sentry.captureException(error, {
        tags: { area: 'gift-transfer' },
        extra: { bookingId: booking.id },
      });
    }
  }
  return { scanned: bookings.length, transferred, failed };
}
