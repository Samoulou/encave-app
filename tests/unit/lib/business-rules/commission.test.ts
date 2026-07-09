import { describe, it, expect } from 'vitest';
import {
  getEffectiveCommissionRate,
  computeCommissionCents,
} from '@/lib/business-rules/commission';

describe('commission', () => {
  it('uses the winery rate when set — Founders at 0%', () => {
    expect(getEffectiveCommissionRate({ commissionRate: 0 }, 0.12)).toBe(0);
  });

  it('uses a custom per-winery rate over the default', () => {
    expect(getEffectiveCommissionRate({ commissionRate: 0.08 }, 0.12)).toBe(
      0.08
    );
  });

  it('falls back to the platform default when the rate is null', () => {
    expect(getEffectiveCommissionRate({ commissionRate: null }, 0.12)).toBe(
      0.12
    );
    expect(getEffectiveCommissionRate({ commissionRate: null }, 0.1)).toBe(0.1);
  });

  it('computes the commission in whole cents (rounded)', () => {
    expect(computeCommissionCents(9000, 0.12)).toBe(1080);
    expect(computeCommissionCents(9000, 0)).toBe(0);
    // rounding: 3333 × 0.1 = 333.3 → 333
    expect(computeCommissionCents(3333, 0.1)).toBe(333);
    // rounding up: 3335 × 0.1 = 333.5 → 334
    expect(computeCommissionCents(3335, 0.1)).toBe(334);
  });
});
