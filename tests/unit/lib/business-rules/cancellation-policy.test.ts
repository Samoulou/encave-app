import { describe, it, expect } from 'vitest';
import {
  getRefundPercent,
  computeRefundCents,
  computeBookingRefund,
  getPolicyTiers,
  splitRefundBetweenCardAndGift,
} from '@/lib/business-rules/cancellation-policy';

// Barèmes D1 (plan P-03 §7, validés Sam 09.07.2026):
//   FLEXIBLE — 100% ≥ 2h · STANDARD — 100% ≥ 24h · STRICT — 100% ≥ 7j, 50% ≥ 48h

describe('cancellation-policy', () => {
  describe('getRefundPercent — boundaries', () => {
    it.each([
      // [policy, hoursUntilStart, expected %]
      ['FLEXIBLE', 2, 100],
      ['FLEXIBLE', 1, 0],
      ['FLEXIBLE', 0, 0],
      ['FLEXIBLE', 500, 100],
      ['STANDARD', 24, 100], // exact boundary: still refunded
      ['STANDARD', 25, 100],
      ['STANDARD', 23, 0],
      ['STANDARD', 0, 0],
      ['STRICT', 168, 100], // 7 days exactly
      ['STRICT', 169, 100],
      ['STRICT', 167, 50],
      ['STRICT', 48, 50], // 48h exactly
      ['STRICT', 47, 0],
      ['STRICT', 2, 0],
    ] as const)('%s at %sh → %s%%', (policy, hours, expected) => {
      expect(getRefundPercent(policy, hours)).toBe(expected);
    });
  });

  describe('computeRefundCents', () => {
    it('refunds the full paid amount (tickets + fee) on a 100% tier', () => {
      // 2 tickets à 45.00 + 2 × 2.50 de frais = 95.00
      expect(computeRefundCents('STANDARD', 48, 9500)).toBe(9500);
    });

    it('refunds exactly half on the STRICT 50% tier — fee included (D2)', () => {
      expect(computeRefundCents('STRICT', 72, 9500)).toBe(4750);
    });

    it('rounds to the cent', () => {
      // 50% of an odd amount
      expect(computeRefundCents('STRICT', 72, 101)).toBe(51);
    });

    it('refunds nothing below the last tier', () => {
      expect(computeRefundCents('STANDARD', 3, 9500)).toBe(0);
      expect(computeRefundCents('STRICT', 12, 9500)).toBe(0);
    });

    it('refunds nothing for a past or imminent slot', () => {
      expect(computeRefundCents('FLEXIBLE', 0, 9500)).toBe(0);
    });
  });

  describe('getPolicyTiers (UI display)', () => {
    it('exposes tiers ordered by minHours descending', () => {
      for (const policy of ['FLEXIBLE', 'STANDARD', 'STRICT'] as const) {
        const tiers = getPolicyTiers(policy);
        expect(tiers.length).toBeGreaterThan(0);
        const hours = tiers.map((t) => t.minHours);
        expect([...hours].sort((a, b) => b - a)).toEqual(hours);
      }
    });
  });

  describe('computeBookingRefund — already-refunded subtraction', () => {
    const baseBooking = {
      totalPrice: 20000,
      serviceFeeCents: 1000,
      refundAmount: null,
      cancellationPolicy: 'STANDARD' as const,
      winery: { cancellationPolicy: 'FLEXIBLE' as const },
    };

    it('uses the snapshot policy and refunds the full paid amount', () => {
      const r = computeBookingRefund(baseBooking, 48);
      expect(r.policy).toBe('STANDARD');
      expect(r.paidCents).toBe(21000);
      expect(r.refundDueCents).toBe(21000);
    });

    it('subtracts a prior partial refund from what the policy owes', () => {
      const r = computeBookingRefund(
        { ...baseBooking, refundAmount: 5000 },
        48
      );
      expect(r.alreadyRefundedCents).toBe(5000);
      expect(r.refundDueCents).toBe(16000);
    });

    it('never goes negative when the prior refund exceeds the policy due', () => {
      const strict = {
        ...baseBooking,
        cancellationPolicy: 'STRICT' as const,
        refundAmount: 15000, // more than the 50% tier owes (10500)
      };
      const r = computeBookingRefund(strict, 72);
      expect(r.refundDueCents).toBe(0);
    });

    it('falls back to the winery policy for legacy bookings', () => {
      const r = computeBookingRefund(
        { ...baseBooking, cancellationPolicy: null },
        3
      );
      // FLEXIBLE fallback: 100% until 2h → still refundable at 3h.
      expect(r.policy).toBe('FLEXIBLE');
      expect(r.refundDueCents).toBe(21000);
    });
  });

  describe('splitRefundBetweenCardAndGift (P-16 / ADR-0003)', () => {
    it('full refund on a partial gift: card first, remainder onto the gift', () => {
      expect(
        splitRefundBetweenCardAndGift({
          refundDueCents: 12000,
          cardPaidCents: 7000,
          giftAppliedCents: 5000,
          alreadyRefundedCents: 0,
        })
      ).toEqual({ cardRefundCents: 7000, giftRestoreCents: 5000 });
    });

    it('50% refund smaller than the card charge: gift untouched', () => {
      expect(
        splitRefundBetweenCardAndGift({
          refundDueCents: 6000,
          cardPaidCents: 7000,
          giftAppliedCents: 5000,
          alreadyRefundedCents: 0,
        })
      ).toEqual({ cardRefundCents: 6000, giftRestoreCents: 0 });
    });

    it('card=0 booking: everything back onto the gift', () => {
      expect(
        splitRefundBetweenCardAndGift({
          refundDueCents: 12000,
          cardPaidCents: 0,
          giftAppliedCents: 12000,
          alreadyRefundedCents: 0,
        })
      ).toEqual({ cardRefundCents: 0, giftRestoreCents: 12000 });
    });

    it('prior refund consumes the card headroom first', () => {
      expect(
        splitRefundBetweenCardAndGift({
          refundDueCents: 8000,
          cardPaidCents: 7000,
          giftAppliedCents: 5000,
          alreadyRefundedCents: 3000,
        })
      ).toEqual({ cardRefundCents: 4000, giftRestoreCents: 4000 });
    });

    it('clamps to zero — never negative, never above the gift applied', () => {
      expect(
        splitRefundBetweenCardAndGift({
          refundDueCents: 20000,
          cardPaidCents: 7000,
          giftAppliedCents: 5000,
          alreadyRefundedCents: 9000,
        })
      ).toEqual({ cardRefundCents: 0, giftRestoreCents: 5000 });
    });
  });
});
