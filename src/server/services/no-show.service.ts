import { NoShowChargeStatus } from '@prisma/client';
import { getStripe } from '@/server/stripe';
import { db } from '@/server/db';
import { logInfo } from '@/lib/logger';

/**
 * Refund a previously-charged no-show fee (P-08, decision D2).
 *
 * Called when a winemaker reverts a NO_SHOW back to CONFIRMED after the fee
 * was already captured: the guest is no longer a no-show, so they must not
 * stay charged. Full refund with reverse_transfer (pull the winery's share
 * back) + refund_application_fee (give the platform commission back too).
 * Idempotent: the deterministic key + the noShowFeeRefundId presence guard
 * make a re-call a no-op. No-op when nothing was charged.
 *
 * Throws on a Stripe failure — the caller must NOT revert the status if the
 * money could not be returned.
 */
export async function refundNoShowFeeIfCharged(
  bookingId: string
): Promise<{ refunded: boolean; refundId?: string; amountCents?: number }> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      reference: true,
      noShowFeeChargeStatus: true,
      noShowFeeChargePaymentIntentId: true,
      noShowFeeChargedCents: true,
      noShowFeeRefundId: true,
      noShowFeeRefundedCents: true,
    },
  });

  if (
    !booking ||
    booking.noShowFeeChargeStatus !== NoShowChargeStatus.CHARGED ||
    !booking.noShowFeeChargePaymentIntentId
  ) {
    return { refunded: false };
  }

  // Already refunded — idempotent no-op.
  if (booking.noShowFeeRefundId) {
    return {
      refunded: true,
      refundId: booking.noShowFeeRefundId,
      amountCents: booking.noShowFeeRefundedCents ?? undefined,
    };
  }

  const refund = await getStripe().refunds.create(
    {
      payment_intent: booking.noShowFeeChargePaymentIntentId,
      reverse_transfer: true,
      refund_application_fee: true,
      metadata: {
        bookingId,
        bookingReference: booking.reference,
        kind: 'no_show_fee_refund',
      },
    },
    { idempotencyKey: `no-show-fee-refund:${bookingId}` }
  );

  await db.booking.update({
    where: { id: bookingId },
    data: {
      noShowFeeRefundId: refund.id,
      noShowFeeRefundedCents: booking.noShowFeeChargedCents ?? null,
    },
  });

  logInfo('no-show.fee.refunded', {
    bookingId,
    refundId: refund.id,
    amountCents: booking.noShowFeeChargedCents ?? undefined,
  });

  return {
    refunded: true,
    refundId: refund.id,
    amountCents: booking.noShowFeeChargedCents ?? undefined,
  };
}
