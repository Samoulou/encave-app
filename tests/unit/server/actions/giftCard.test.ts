import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock('@/server/queries/feature-flags.queries', () => ({
  isFlagEnabled: vi.fn(),
}));

vi.mock('@/server/services/rate-limit.service', () => ({
  checkRateLimit: vi.fn(async () => ({ success: true })),
  getClientIp: vi.fn(() => 'test-ip'),
  BOOKING_RATE_LIMIT: { limit: 5, windowMs: 1000 },
}));

const sessionsCreate = vi.fn();
vi.mock('@/server/stripe', () => ({
  getStripe: () => ({ checkout: { sessions: { create: sessionsCreate } } }),
}));

vi.mock('@/server/db', () => ({
  db: { experience: { findUnique: vi.fn() } },
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  getBaseUrl: () => 'https://encave.ch',
}));

const { isFlagEnabled } =
  await import('@/server/queries/feature-flags.queries');
const { checkRateLimit } = await import('@/server/services/rate-limit.service');
const { db } = await import('@/server/db');
const { createGiftCardCheckoutAction } =
  await import('@/server/actions/giftCard');

const validInput = {
  nature: 'AMOUNT' as const,
  amountCents: 10000,
  purchaserName: 'Jean',
  purchaserEmail: 'jean@example.com',
  recipientEmail: 'marie@example.com',
  deliverAt: '2026-12-24T12:00:00.000Z',
  variant: 'NOEL' as const,
  locale: 'fr' as const,
};

describe('createGiftCardCheckoutAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFlagEnabled).mockResolvedValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue({ success: true } as never);
    sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/x' });
  });

  it('returns NOT_FOUND when the GIFT_CARDS flag is OFF', async () => {
    vi.mocked(isFlagEnabled).mockResolvedValue(false);
    const result = await createGiftCardCheckoutAction(validInput);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND');
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('rate-limits per IP', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ success: false } as never);
    const result = await createGiftCardCheckoutAction(validInput);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RATE_LIMITED');
  });

  it('rejects invalid input (bad amount)', async () => {
    const result = await createGiftCardCheckoutAction({
      ...validInput,
      amountCents: 999,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates a Stripe session with the value + fee lines and no winery transfer', async () => {
    const result = await createGiftCardCheckoutAction(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.checkoutUrl).toBe('https://checkout.stripe.com/x');
    }
    const params = sessionsCreate.mock.calls[0]?.[0];
    expect(params.line_items).toHaveLength(2);
    expect(params.line_items[0].price_data.unit_amount).toBe(10000);
    expect(params.line_items[1].price_data.unit_amount).toBe(250);
    // Platform funds — never a winery transfer/commission at purchase.
    expect(params.payment_intent_data).toBeUndefined();
    expect(params.metadata.kind).toBe('gift_card');
    expect(params.metadata.amountCents).toBe('10000');
  });

  it('resolves the value from the experience price for the EXPERIENCE nature', async () => {
    vi.mocked(db.experience.findUnique).mockResolvedValue({
      id: 'exp-1',
      title: 'Balade',
      price: 8000,
      status: 'PUBLISHED',
      winery: { status: 'VERIFIED' },
    } as never);
    const result = await createGiftCardCheckoutAction({
      nature: 'EXPERIENCE',
      experienceId: 'cjld2cjxh0000qzrmn831i7rn',
      purchaserName: 'Jean',
      purchaserEmail: 'jean@example.com',
      recipientEmail: 'marie@example.com',
      deliverAt: '2026-12-24T12:00:00.000Z',
      variant: 'NEUTRE',
      locale: 'fr',
    });
    expect(result.success).toBe(true);
    const params = sessionsCreate.mock.calls[0]?.[0];
    expect(params.line_items[0].price_data.unit_amount).toBe(8000);
    expect(params.metadata.experienceId).toBe('exp-1');
    expect(params.metadata.experienceTitle).toBe('Balade');
  });

  it('refuses a gift on an unpublished experience', async () => {
    vi.mocked(db.experience.findUnique).mockResolvedValue({
      id: 'exp-1',
      title: 'Balade',
      price: 8000,
      status: 'DRAFT',
      winery: { status: 'VERIFIED' },
    } as never);
    const result = await createGiftCardCheckoutAction({
      nature: 'EXPERIENCE',
      experienceId: 'cjld2cjxh0000qzrmn831i7rn',
      purchaserName: 'Jean',
      purchaserEmail: 'jean@example.com',
      recipientEmail: 'marie@example.com',
      deliverAt: '2026-12-24T12:00:00.000Z',
      variant: 'NEUTRE',
      locale: 'fr',
    });
    expect(result.success).toBe(false);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});
