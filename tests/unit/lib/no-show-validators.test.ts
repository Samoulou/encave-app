import { describe, it, expect } from 'vitest';
import { setWineryNoShowPolicySchema } from '@/lib/validators/winery';
import { createExperienceSchema } from '@/lib/validators/experience';

describe('setWineryNoShowPolicySchema (P-08)', () => {
  const base = { wineryId: 'w1', enabled: true };

  it('accepts a fee within 0–50 CHF', () => {
    expect(
      setWineryNoShowPolicySchema.safeParse({ ...base, feeCents: 1500 }).success
    ).toBe(true);
    expect(
      setWineryNoShowPolicySchema.safeParse({ ...base, feeCents: 0 }).success
    ).toBe(true);
    expect(
      setWineryNoShowPolicySchema.safeParse({ ...base, feeCents: 5000 }).success
    ).toBe(true);
  });

  it('rejects a fee above 50 CHF', () => {
    expect(
      setWineryNoShowPolicySchema.safeParse({ ...base, feeCents: 5001 }).success
    ).toBe(false);
  });

  it('rejects a negative or non-integer fee', () => {
    expect(
      setWineryNoShowPolicySchema.safeParse({ ...base, feeCents: -1 }).success
    ).toBe(false);
    expect(
      setWineryNoShowPolicySchema.safeParse({ ...base, feeCents: 12.5 }).success
    ).toBe(false);
  });

  it('rejects a missing wineryId', () => {
    expect(
      setWineryNoShowPolicySchema.safeParse({
        wineryId: '',
        enabled: true,
        feeCents: 1500,
      }).success
    ).toBe(false);
  });
});

describe('createExperienceSchema paymentMode price rule (P-08)', () => {
  const base = {
    title: 'Dégustation découverte',
    type: 'TASTING' as const,
    description: 'x'.repeat(120),
    duration: 120,
    minCapacity: 1,
    maxCapacity: 8,
  };

  it('allows price 0 for an ON_SITE offer (free)', () => {
    const result = createExperienceSchema.safeParse({
      ...base,
      price: 0,
      paymentMode: 'ON_SITE',
    });
    expect(result.success).toBe(true);
  });

  it('rejects price 0 for an ONLINE offer', () => {
    const result = createExperienceSchema.safeParse({
      ...base,
      price: 0,
      paymentMode: 'ONLINE',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a positive price for ON_SITE (pay-on-site)', () => {
    const result = createExperienceSchema.safeParse({
      ...base,
      price: 45,
      paymentMode: 'ON_SITE',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a positive price for ONLINE', () => {
    const result = createExperienceSchema.safeParse({
      ...base,
      price: 45,
      paymentMode: 'ONLINE',
    });
    expect(result.success).toBe(true);
  });
});
