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
