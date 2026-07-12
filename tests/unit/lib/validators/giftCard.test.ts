import { describe, expect, it } from 'vitest';
import {
  createGiftCardSchema,
  giftCardFormSchema,
} from '@/lib/validators/giftCard';

const CUID = 'cjld2cjxh0000qzrmn831i7rn';

const baseAmount = {
  nature: 'AMOUNT' as const,
  amountCents: 10000,
  purchaserName: 'Jean',
  purchaserEmail: 'jean@example.com',
  recipientEmail: 'marie@example.com',
  deliverAt: '2026-12-24T12:00:00.000Z',
  variant: 'NOEL' as const,
};

describe('createGiftCardSchema', () => {
  it('accepts a valid free-amount gift', () => {
    expect(createGiftCardSchema.safeParse(baseAmount).success).toBe(true);
  });

  it('rejects an amount below the 20 CHF floor', () => {
    const r = createGiftCardSchema.safeParse({
      ...baseAmount,
      amountCents: 1000,
    });
    expect(r.success).toBe(false);
  });

  it('rejects an amount above the 500 CHF ceiling', () => {
    const r = createGiftCardSchema.safeParse({
      ...baseAmount,
      amountCents: 60000,
    });
    expect(r.success).toBe(false);
  });

  it('rejects an amount that is not a multiple of 10 CHF', () => {
    const r = createGiftCardSchema.safeParse({
      ...baseAmount,
      amountCents: 13700,
    });
    expect(r.success).toBe(false);
  });

  it('requires experienceId for the EXPERIENCE nature', () => {
    const r = createGiftCardSchema.safeParse({
      nature: 'EXPERIENCE',
      purchaserName: 'Jean',
      purchaserEmail: 'jean@example.com',
      recipientEmail: 'marie@example.com',
      deliverAt: '2026-12-24T12:00:00.000Z',
      variant: 'NEUTRE',
    });
    expect(r.success).toBe(false);
  });

  it('accepts a valid EXPERIENCE gift', () => {
    const r = createGiftCardSchema.safeParse({
      nature: 'EXPERIENCE',
      experienceId: CUID,
      purchaserName: 'Jean',
      purchaserEmail: 'jean@example.com',
      recipientEmail: 'marie@example.com',
      deliverAt: '2026-12-24T12:00:00.000Z',
      variant: 'ANNIVERSAIRE',
    });
    expect(r.success).toBe(true);
  });

  it('rejects an invalid recipient email', () => {
    const r = createGiftCardSchema.safeParse({
      ...baseAmount,
      recipientEmail: 'not-an-email',
    });
    expect(r.success).toBe(false);
  });
});

describe('giftCardFormSchema', () => {
  const validForm = {
    nature: 'AMOUNT' as const,
    amountCents: 10000,
    variant: 'NEUTRE' as const,
    purchaserName: 'Jean',
    purchaserEmail: 'jean@example.com',
    recipientEmail: 'marie@example.com',
    deliverDate: '2026-12-24',
  };

  it('accepts a valid form', () => {
    expect(giftCardFormSchema.safeParse(validForm).success).toBe(true);
  });

  it('flags a missing experience when nature is EXPERIENCE', () => {
    const r = giftCardFormSchema.safeParse({
      ...validForm,
      nature: 'EXPERIENCE',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'experienceId')).toBe(
        true
      );
    }
  });

  it('allows empty optional recipient name and message', () => {
    const r = giftCardFormSchema.safeParse({
      ...validForm,
      recipientName: '',
      message: '',
    });
    expect(r.success).toBe(true);
  });
});
