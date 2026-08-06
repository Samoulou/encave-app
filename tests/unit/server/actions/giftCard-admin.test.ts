import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/admin-guard', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/server/auth', () => ({ auth: vi.fn() }));

vi.mock('@/server/db', () => ({
  db: { giftCard: { updateMany: vi.fn(), findFirst: vi.fn() } },
}));

vi.mock('@/server/services/giftCard-delivery.service', () => ({
  resendGiftCardEmail: vi.fn(),
}));

// Pull-in guards for the module (unused here but imported by the action file).
vi.mock('@/server/queries/feature-flags.queries', () => ({
  isFlagEnabled: vi.fn(),
}));
vi.mock('@/server/services/rate-limit.service', () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  BOOKING_RATE_LIMIT: {},
}));
vi.mock('@/server/stripe', () => ({ getStripe: vi.fn() }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/lib/env', () => ({ getBaseUrl: () => 'https://encave.ch' }));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { requireAdmin } = await import('@/server/admin-guard');
const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { resendGiftCardEmail } =
  await import('@/server/services/giftCard-delivery.service');
const { disableGiftCardAction, resendGiftCardAction } =
  await import('@/server/actions/giftCard');

const CUID = 'cjld2cjxh0000qzrmn831i7rn';

describe('disableGiftCardAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses a non-admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      success: false,
      error: { code: 'FORBIDDEN', message: 'x' },
    } as never);
    const r = await disableGiftCardAction({ giftCardId: CUID });
    expect(r.success).toBe(false);
    expect(db.giftCard.updateMany).not.toHaveBeenCalled();
  });

  it('validates the id', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      success: true,
      data: { adminId: 'a1' },
    } as never);
    const r = await disableGiftCardAction({ giftCardId: 'nope' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('VALIDATION_ERROR');
  });

  it('disables an active card (status only, ledger untouched)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      success: true,
      data: { adminId: 'a1' },
    } as never);
    vi.mocked(db.giftCard.updateMany).mockResolvedValue({ count: 1 } as never);
    const r = await disableGiftCardAction({ giftCardId: CUID });
    expect(r.success).toBe(true);
    const call = vi.mocked(db.giftCard.updateMany).mock.calls[0]?.[0];
    expect(call?.data).toEqual({ status: 'DISABLED' });
    expect(call?.where.status).toEqual({ not: 'DISABLED' });
  });

  it('returns NOT_FOUND when nothing was disabled', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      success: true,
      data: { adminId: 'a1' },
    } as never);
    vi.mocked(db.giftCard.updateMany).mockResolvedValue({ count: 0 } as never);
    const r = await disableGiftCardAction({ giftCardId: CUID });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('NOT_FOUND');
  });
});

describe('resendGiftCardAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires a signed-in user', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const r = await resendGiftCardAction({ giftCardId: CUID });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('UNAUTHORIZED');
  });

  it('refuses a card the caller does not own', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: 'someone@else.com' },
    } as never);
    vi.mocked(db.giftCard.findFirst).mockResolvedValue(null as never);
    const r = await resendGiftCardAction({ giftCardId: CUID });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('NOT_FOUND');
    expect(resendGiftCardEmail).not.toHaveBeenCalled();
  });

  it('resends for an owned card', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: 'jean@example.com' },
    } as never);
    vi.mocked(db.giftCard.findFirst).mockResolvedValue({ id: CUID } as never);
    vi.mocked(resendGiftCardEmail).mockResolvedValue(true);
    const r = await resendGiftCardAction({ giftCardId: CUID });
    expect(r.success).toBe(true);
    expect(resendGiftCardEmail).toHaveBeenCalledWith(CUID);
  });
});
