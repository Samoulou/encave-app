/**
 * Security lot (audit M1 + M3) — configuration guards that must hold on
 * every better-auth bump. The behaviour itself is proven against a real
 * database in tests/db/auth-security.test.ts (not run by the GitHub CI);
 * this suite keeps the switches from being flipped silently.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/server/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('@/server/services/email.service', () => ({
  sendOtpEmail: vi.fn(),
  sendEmailVerificationEmail: vi.fn(),
  sendEmailChangedNoticeEmail: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}));

const { db } = await import('@/server/db');
const { auth } = await import('@/server/better-auth');
const { parseUserInput } = await import('better-auth/db');

describe('pre-account hijack switches (M3)', () => {
  it('never opts out of the "local email must be verified" OAuth link gate', () => {
    // better-auth ≥1.7 refuses to auto-link Google to an UNVERIFIED local
    // account unless this is explicitly false.
    expect(
      auth.options.account?.accountLinking?.requireLocalEmailVerified
    ).not.toBe(false);
    expect(auth.options.account?.accountLinking?.allowDifferentEmails).toBe(
      false
    );
  });

  it('revokes every session on a password reset', () => {
    expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(
      true
    );
  });

  it('does not let the instant (unverified) email change be enabled', () => {
    expect(
      auth.options.user?.changeEmail?.updateEmailWithoutVerification
    ).not.toBe(true);
  });
});

describe('suspension travels with the session user (M1)', () => {
  it('declares suspendedAt as a non-input additional field', () => {
    expect(auth.options.user?.additionalFields?.suspendedAt).toMatchObject({
      type: 'date',
      input: false,
    });
  });

  it('a request body can never clear or set suspendedAt', () => {
    expect(
      'suspendedAt' in
        parseUserInput(auth.options, { suspendedAt: null }, 'create')
    ).toBe(false);
    expect(() =>
      parseUserInput(
        auth.options,
        { suspendedAt: new Date().toISOString() },
        'update'
      )
    ).toThrow(/suspendedAt is not allowed to be set/);
  });
});

describe('session create hook — central suspension gate (M1)', () => {
  const before = auth.options.databaseHooks?.session?.create?.before;
  const session = {
    id: 's1',
    token: 't1',
    userId: 'user-1',
    expiresAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  async function run() {
    if (!before) throw new Error('session.create.before hook is missing');
    return before(session, null);
  }

  it('refuses a suspended user with ACCOUNT_SUSPENDED', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      role: 'WINEMAKER',
      suspendedAt: new Date(),
    } as never);

    await expect(run()).rejects.toMatchObject({
      status: 'FORBIDDEN',
      body: { code: 'ACCOUNT_SUSPENDED' },
    });
  });

  it('refuses when the user row cannot be found (fail closed)', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);

    await expect(run()).rejects.toMatchObject({ status: 'FORBIDDEN' });
  });

  it('reads role and suspension in ONE query and applies the role window', async () => {
    vi.mocked(db.user.findUnique).mockClear();
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      role: 'ADMIN',
      suspendedAt: null,
    } as never);

    const result = await run();

    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { role: true, suspendedAt: true },
    });
    const expiresAt = (result as { data: { expiresAt: Date } }).data.expiresAt;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(
      Math.abs(expiresAt.getTime() - (Date.now() + sevenDays))
    ).toBeLessThan(5000);
  });
});

describe('client IP resolution for the rate limiter', () => {
  it('reads the single-value headers Vercel overwrites', () => {
    expect(auth.options.advanced?.ipAddress?.ipAddressHeaders).toEqual([
      'x-forwarded-for',
      'x-real-ip',
    ]);
  });
});
