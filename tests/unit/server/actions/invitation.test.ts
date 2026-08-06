import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('@/server/admin-guard', () => ({ requireAdmin: vi.fn() }));

vi.mock('@/server/db', () => ({
  db: {
    invitation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    winery: { findUnique: vi.fn(), create: vi.fn() },
    user: { update: vi.fn() },
    verificationLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/utils/token', () => ({ hashToken: (t: string) => `hash:${t}` }));
vi.mock('@/lib/utils/slug', () => ({
  generateSlug: (s: string) => s.toLowerCase().replace(/\s+/g, '-'),
  ensureUniqueSlug: vi.fn(async (base: string) => base),
}));
vi.mock('@/lib/env', () => ({ getBaseUrl: () => 'https://encave.ch' }));
vi.mock('@/server/actions/winery-helpers', () => ({
  invalidateWineryCaches: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { auth } = await import('@/server/auth');
const { requireAdmin } = await import('@/server/admin-guard');
const { db } = await import('@/server/db');
const { createFounderInvitation, provisionFounderWinery } =
  await import('@/server/actions/invitation');

const TOKEN = 'a'.repeat(40);
const adminOk = { success: true as const, data: { adminId: 'admin-1' } };

const session: Session = {
  user: {
    id: 'user-1',
    email: 'founder@test.ch',
    name: 'Founder',
    role: 'CLIENT',
    preferredLocale: 'FR',
    twoFactorEnabled: false,
  },
};

describe('createFounderInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(adminOk);
    vi.mocked(db.invitation.create).mockResolvedValue({} as never);
  });

  it('is FORBIDDEN for a non-admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });
    const result = await createFounderInvitation({
      email: 'a@b.ch',
      wineryName: 'Cave',
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(db.invitation.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid email', async () => {
    const result = await createFounderInvitation({
      email: 'not-an-email',
      wineryName: 'Cave',
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(db.invitation.create).not.toHaveBeenCalled();
  });

  it('creates an invitation and returns a link (happy path)', async () => {
    const result = await createFounderInvitation({
      email: 'Founder@Test.ch',
      wineryName: 'Domaine Test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toMatch(
        /^https:\/\/encave\.ch\/invitation\/[a-f0-9]+$/
      );
    }
    // Token stored hashed, email lowercased.
    expect(db.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'founder@test.ch',
          invitedBy: 'admin-1',
        }),
      })
    );
    const data = vi.mocked(db.invitation.create).mock.calls[0]?.[0]?.data as {
      tokenHash: string;
    };
    expect(data.tokenHash.startsWith('hash:')).toBe(true);
  });
});

describe('provisionFounderWinery', () => {
  const validInvitation = {
    id: 'inv-1',
    email: 'founder@test.ch', // matches the session user
    acceptedAt: null,
    expiresAt: new Date(Date.now() + 86400000),
    invitedBy: 'admin-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(db.invitation.findUnique).mockResolvedValue(
      validInvitation as never
    );
    vi.mocked(db.invitation.updateMany).mockResolvedValue({
      count: 1,
    } as never);
    vi.mocked(db.winery.findUnique).mockResolvedValue(null); // no existing winery
    vi.mocked(db.winery.create).mockResolvedValue({
      id: 'winery-1',
      slug: 'domaine-test',
    } as never);
    vi.mocked(db.$transaction).mockImplementation(((fn: unknown) =>
      typeof fn === 'function'
        ? (fn as (tx: typeof db) => unknown)(db)
        : Promise.resolve(fn)) as never);
  });

  const input = { token: TOKEN, wineryName: 'Domaine Test' };

  it('rejects unauthenticated callers', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await provisionFounderWinery(input);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(db.winery.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid (too short) token', async () => {
    const result = await provisionFounderWinery({ ...input, token: 'short' });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('is NOT_FOUND when the token has no invitation', async () => {
    vi.mocked(db.invitation.findUnique).mockResolvedValue(null);
    const result = await provisionFounderWinery(input);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('is CONFLICT when the invitation is already accepted', async () => {
    vi.mocked(db.invitation.findUnique).mockResolvedValue({
      ...validInvitation,
      acceptedAt: new Date(),
    } as never);
    const result = await provisionFounderWinery(input);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
  });

  it('is CONFLICT when the invitation is expired', async () => {
    vi.mocked(db.invitation.findUnique).mockResolvedValue({
      ...validInvitation,
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    const result = await provisionFounderWinery(input);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
  });

  it('is CONFLICT when the user already has a winery', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue({ id: 'w0' } as never);
    const result = await provisionFounderWinery(input);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
    expect(db.winery.create).not.toHaveBeenCalled();
  });

  it('provisions a VERIFIED FOUNDER winery (happy path)', async () => {
    const result = await provisionFounderWinery(input);
    expect(result).toMatchObject({
      success: true,
      data: { wineryId: 'winery-1', slug: 'domaine-test' },
    });
    expect(db.winery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'VERIFIED',
          plan: 'FOUNDER',
          commissionRate: 0,
          userId: 'user-1',
        }),
      })
    );
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'WINEMAKER' } })
    );
    // Consumed via a CAS updateMany (acceptedAt null) — not a bare update.
    expect(db.invitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1', acceptedAt: null },
        data: expect.objectContaining({ acceptedUserId: 'user-1' }),
      })
    );
  });

  it('is FORBIDDEN when the caller email differs from the invited email', async () => {
    vi.mocked(db.invitation.findUnique).mockResolvedValue({
      ...validInvitation,
      email: 'someone-else@test.ch',
    } as never);
    const result = await provisionFounderWinery(input);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(db.winery.create).not.toHaveBeenCalled();
  });

  it('is CONFLICT when the CAS consume loses the race (count 0)', async () => {
    vi.mocked(db.invitation.updateMany).mockResolvedValue({
      count: 0,
    } as never);
    const result = await provisionFounderWinery(input);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
  });
});
