import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('@/server/db', () => ({ db: { user: { update: vi.fn() } } }));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { updateConsent } = await import('@/server/actions/consent');

const session: Session = {
  user: {
    id: 'user-1',
    email: 'client@test.ch',
    name: 'Client',
    role: 'CLIENT',
    preferredLocale: 'FR',
    twoFactorEnabled: false,
    emailVerified: true,
  },
};

const { CONSENT_VERSION } = await import('@/lib/constants/consent');

const validConsent = {
  necessary: true as const,
  analytics: true,
  version: CONSENT_VERSION,
  consentedAt: '2026-11-12T10:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateConsent', () => {
  it.each([
    ['a wrong type', { ...validConsent, analytics: 'yes' }],
    ['necessary cookies declined', { ...validConsent, necessary: false }],
    ['a stale consent version', { ...validConsent, version: 'v0-unknown' }],
    ['a missing timestamp', { necessary: true, analytics: false }],
  ])('rejects %s without reading the session', async (_, payload) => {
    const result = await updateConsent(payload);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(auth).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('anonymous visitor: succeeds without persisting (consent lives in the browser)', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await updateConsent(validConsent);

    expect(result).toEqual({ success: true, data: null });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("signed-in user: stores the consent on the caller's own row", async () => {
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(db.user.update).mockResolvedValue({} as never);

    const result = await updateConsent(validConsent);

    expect(result).toEqual({ success: true, data: null });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { cookieConsent: validConsent },
    });
  });

  it('never throws: a DB failure becomes INTERNAL_ERROR', async () => {
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(db.user.update).mockRejectedValue(new Error('db down'));

    const result = await updateConsent(validConsent);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });
});
