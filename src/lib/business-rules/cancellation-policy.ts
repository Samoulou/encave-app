/**
 * Per-winery cancellation policies (P-03 / L-043, PRD §5).
 *
 * Barèmes validated by Sam (2026-07-09, plan P-03 §7 D1):
 *   FLEXIBLE — 100% refund until 2h before the slot, 0% after.
 *   STANDARD — 100% until 24h, 0% after (the historical hardcoded rule;
 *              every existing winery defaults to it → no behavior change
 *              until a winery explicitly picks another policy).
 *   STRICT   — 100% until 7 days, 50% until 48h, 0% after.
 *
 * D2: the refund percentage applies to the FULL amount paid (tickets +
 * service fee) — no margin kept on a refunded booking.
 *
 * Pure module — no dates math beyond a precomputed hoursUntilStart; the
 * caller derives it (date-fns differenceInHours on date+timeSlot).
 */

import type { CancellationPolicy } from '@prisma/client';

type RefundTier = {
  /** Refund applies when hoursUntilStart >= minHours. */
  minHours: number;
  /** Integer percentage refunded, 0–100. */
  percent: number;
};

/** Tiers ordered by minHours DESC; first matching tier wins; 0% floor. */
const POLICY_TIERS: Record<CancellationPolicy, readonly RefundTier[]> = {
  FLEXIBLE: [{ minHours: 2, percent: 100 }],
  STANDARD: [{ minHours: 24, percent: 100 }],
  STRICT: [
    { minHours: 168, percent: 100 }, // 7 days
    { minHours: 48, percent: 50 },
  ],
};

/** Percentage (0–100) refunded for a cancellation at hoursUntilStart. */
export function getRefundPercent(
  policy: CancellationPolicy,
  hoursUntilStart: number
): number {
  for (const tier of POLICY_TIERS[policy]) {
    if (hoursUntilStart >= tier.minHours) {
      return tier.percent;
    }
  }
  return 0;
}

/**
 * Refund amount in cents on the full paid amount (tickets + service fee).
 * Rounded to the cent; 0 for a past or imminent slot.
 */
export function computeRefundCents(
  policy: CancellationPolicy,
  hoursUntilStart: number,
  paidCents: number
): number {
  const percent = getRefundPercent(policy, hoursUntilStart);
  return Math.round((paidCents * percent) / 100);
}

/** Tier table exposed for UI display (fiche, checkout, page légale). */
export function getPolicyTiers(
  policy: CancellationPolicy
): readonly RefundTier[] {
  return POLICY_TIERS[policy];
}

/**
 * Refund derivation for a booking cancellation — the single source used
 * by every cancellation path (guest token, client account, info screen).
 * The policy is the SNAPSHOT taken at booking time when available; the
 * winery's current policy is only a fallback for legacy bookings.
 *
 * `refundAmount` (already refunded, e.g. a prior admin partial refund) is
 * SUBTRACTED from what the policy owes — the cancellation never refunds
 * money that already went back, and the Stripe amount is always explicit
 * so a concurrent refund can't silently change what "the rest" means.
 */
/**
 * P-16 (WS-A.3, ADR-0003): split of `refundDueCents` for a gift-funded
 * booking. Real money first — the card refund is capped by what the card
 * actually paid (net of prior refunds, assumed card-side); the remainder
 * is restored onto the gift card, capped by what the gift covered. Any
 * residual beyond both caps is impossible by construction (refundDue ≤
 * paid − alreadyRefunded) but clamped to 0 defensively.
 */
export function splitRefundBetweenCardAndGift(input: {
  refundDueCents: number;
  /** totalPrice + serviceFee − giftAppliedCents (the platform card charge). */
  cardPaidCents: number;
  giftAppliedCents: number;
  alreadyRefundedCents: number;
}): { cardRefundCents: number; giftRestoreCents: number } {
  const cardHeadroom = Math.max(
    0,
    input.cardPaidCents - input.alreadyRefundedCents
  );
  const cardRefundCents = Math.max(
    0,
    Math.min(input.refundDueCents, cardHeadroom)
  );
  const giftRestoreCents = Math.max(
    0,
    Math.min(input.refundDueCents - cardRefundCents, input.giftAppliedCents)
  );
  return { cardRefundCents, giftRestoreCents };
}

export function computeBookingRefund(
  booking: {
    totalPrice: number;
    serviceFeeCents: number;
    refundAmount: number | null;
    cancellationPolicy: CancellationPolicy | null;
    winery: { cancellationPolicy: CancellationPolicy };
  },
  hoursUntilStart: number
): {
  policy: CancellationPolicy;
  paidCents: number;
  alreadyRefundedCents: number;
  refundDueCents: number;
} {
  const policy =
    booking.cancellationPolicy ?? booking.winery.cancellationPolicy;
  const paidCents = booking.totalPrice + booking.serviceFeeCents;
  const alreadyRefundedCents = booking.refundAmount ?? 0;
  const policyDueCents = computeRefundCents(policy, hoursUntilStart, paidCents);
  const refundDueCents = Math.max(0, policyDueCents - alreadyRefundedCents);
  // (P-16 review: the old `stripeAmountArg` field is gone — since ADR-0003
  // the due amount splits card/gift and no caller may pass it to Stripe.)
  return {
    policy,
    paidCents,
    alreadyRefundedCents,
    refundDueCents,
  };
}
