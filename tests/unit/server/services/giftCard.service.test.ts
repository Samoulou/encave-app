import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

vi.mock('@/server/db', () => ({
  db: {
    giftCard: { findUnique: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/server/services/giftCard-pdf.service', () => ({
  generateGiftCardPDF: vi.fn(async () => Buffer.from('pdf')),
}));

vi.mock('@/server/services/email.service', () => ({
  sendGiftCardPurchaseEmail: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ getBaseUrl: () => 'https://encave.ch' }));

const { db } = await import('@/server/db');
const {
  formatGiftCodeForDisplay,
  generateUniqueGiftCode,
  createGiftCardFromPayment,
} = await import('@/server/services/giftCard.service');

function giftSession(
  overrides: Partial<Stripe.Checkout.Session> = {}
): Stripe.Checkout.Session {
  return {
    payment_intent: 'pi_123',
    customer_email: 'jean@example.com',
    customer_details: null,
    metadata: {
      kind: 'gift_card',
      nature: 'AMOUNT',
      amountCents: '10000',
      recipientEmail: 'marie@example.com',
      purchaserName: 'Jean',
      deliverAt: '2026-12-24T12:00:00.000Z',
      variant: 'NOEL',
      locale: 'fr',
    },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

describe('formatGiftCodeForDisplay', () => {
  it('groups the code in blocks of four', () => {
    expect(formatGiftCodeForDisplay('ABCDEFGHJKMN')).toBe('ABCD-EFGH-JKMN');
  });
});

describe('generateUniqueGiftCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retries on collision then returns a fresh code', async () => {
    vi.mocked(db.giftCard.findUnique)
      .mockResolvedValueOnce({ id: 'x' } as never)
      .mockResolvedValueOnce(null as never);
    const code = await generateUniqueGiftCode();
    expect(code).toHaveLength(12);
    expect(db.giftCard.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe('createGiftCardFromPayment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ignores a session that is not a gift card', async () => {
    const result = await createGiftCardFromPayment(
      giftSession({ metadata: { kind: 'booking' } as never })
    );
    expect(result.created).toBe(false);
    expect(db.giftCard.findFirst).not.toHaveBeenCalled();
  });

  it('is idempotent on the payment intent (webhook redelivery)', async () => {
    vi.mocked(db.giftCard.findFirst).mockResolvedValue({
      id: 'existing',
    } as never);
    const result = await createGiftCardFromPayment(giftSession());
    expect(result).toEqual({ created: false, giftCardId: 'existing' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('throws on incomplete payment context (no payment intent)', async () => {
    await expect(
      createGiftCardFromPayment(giftSession({ payment_intent: null }))
    ).rejects.toThrow();
  });
});
