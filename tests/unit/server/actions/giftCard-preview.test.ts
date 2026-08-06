import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (k: string) => k),
}));
vi.mock('@/server/queries/feature-flags.queries', () => ({
  isFlagEnabled: vi.fn(),
}));
vi.mock('@/server/services/rate-limit.service', () => ({
  checkRateLimit: vi.fn(async () => ({ success: true })),
  getClientIp: vi.fn(() => 'ip'),
  BOOKING_RATE_LIMIT: {},
}));
vi.mock('@/server/services/giftCard-redemption.service', () => ({
  previewGiftRedemption: vi.fn(),
}));
vi.mock('@/server/services/giftCard-delivery.service', () => ({
  resendGiftCardEmail: vi.fn(),
}));
vi.mock('@/server/db', () => ({
  db: { experience: { findUnique: vi.fn() } },
}));
vi.mock('@/server/stripe', () => ({ getStripe: vi.fn() }));
vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('@/server/admin-guard', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/env', () => ({ getBaseUrl: () => 'https://encave.ch' }));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { isFlagEnabled } =
  await import('@/server/queries/feature-flags.queries');
const { previewGiftRedemption } =
  await import('@/server/services/giftCard-redemption.service');
const { db } = await import('@/server/db');
const { previewGiftRedemptionAction } =
  await import('@/server/actions/giftCard');

const CUID = 'cjld2cjxh0000qzrmn831i7rn';
const validInput = { code: 'ABCDEFGHJKMN', experienceId: CUID, guestCount: 2 };

describe('previewGiftRedemptionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFlagEnabled).mockImplementation(async (k) =>
      k === 'GIFT_CARDS' ? true : false
    );
    vi.mocked(db.experience.findUnique).mockResolvedValue({
      price: 4000,
      status: 'PUBLISHED',
    } as never);
  });

  it('is NOT_FOUND when the flag is off', async () => {
    vi.mocked(isFlagEnabled).mockResolvedValue(false);
    const r = await previewGiftRedemptionAction(validInput);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('NOT_FOUND');
  });

  it('computes the due server-side (price × guests) and returns the preview', async () => {
    vi.mocked(previewGiftRedemption).mockResolvedValue({
      ok: true,
      preview: {
        code: 'ABCDEFGHJKMN',
        balance: 5000,
        applicableCents: 5000,
        remainingDueCents: 3000,
      },
    });
    const r = await previewGiftRedemptionAction(validInput);
    expect(r.success).toBe(true);
    // due = 4000 × 2 = 8000 (BOOKING_FEE flag off in this test)
    expect(vi.mocked(previewGiftRedemption).mock.calls[0]?.[0].dueCents).toBe(
      8000
    );
    if (r.success) expect(r.data.dueCents).toBe(8000);
  });

  it('surfaces a redemption error as GIFT_<reason>', async () => {
    vi.mocked(previewGiftRedemption).mockResolvedValue({
      ok: false,
      error: 'DISABLED',
    });
    const r = await previewGiftRedemptionAction(validInput);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.message).toBe('GIFT_DISABLED');
  });

  it('validates input', async () => {
    const r = await previewGiftRedemptionAction({
      code: 'x',
      experienceId: 'nope',
      guestCount: 0,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('VALIDATION_ERROR');
  });
});
