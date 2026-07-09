import { describe, it, expect } from 'vitest';
import {
  getRefundPercent,
  computeRefundCents,
  getPolicyTiers,
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
});
