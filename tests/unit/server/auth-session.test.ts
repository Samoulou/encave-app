/**
 * auth() is the first line of every server action and protected page — it
 * must answer "no session" for a suspended account (audit M1) without any
 * extra DB read: the flag rides on the session user.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock('@/server/better-auth', () => ({
  auth: { api: { getSession, signOut: vi.fn() } },
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}));

vi.mock('@/server/db', () => ({
  db: { user: { findUnique: vi.fn() } },
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { db } = await import('@/server/db');
const { auth } = await import('@/server/auth');

function rawSession(user: Record<string, unknown>) {
  return {
    session: { id: 's1', token: 't1', createdAt: new Date() },
    user: {
      id: 'user-1',
      email: 'someone@encave.ch',
      name: 'Someone',
      role: 'WINEMAKER',
      preferredLocale: 'FR',
      twoFactorEnabled: false,
      emailVerified: true,
      ...user,
    },
  };
}

describe('auth()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the session of an active user', async () => {
    getSession.mockResolvedValue(rawSession({ suspendedAt: null }));

    const session = await auth();

    expect(session?.user).toMatchObject({ id: 'user-1', role: 'WINEMAKER' });
  });

  it('returns null without a session', async () => {
    getSession.mockResolvedValue(null);
    expect(await auth()).toBeNull();
  });

  it.each([
    ['a Date (fresh DB read)', new Date()],
    ['an ISO string (cookie-cached session)', new Date().toISOString()],
  ])(
    'returns null for a suspended user — suspendedAt as %s',
    async (_l, at) => {
      getSession.mockResolvedValue(rawSession({ suspendedAt: at }));

      expect(await auth()).toBeNull();
    }
  );

  it('does not read the database to decide', async () => {
    getSession.mockResolvedValue(rawSession({ suspendedAt: new Date() }));

    await auth();

    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('never exposes suspendedAt on the app session shape', async () => {
    getSession.mockResolvedValue(rawSession({ suspendedAt: null }));

    const session = await auth();

    expect(session && 'suspendedAt' in session.user).toBe(false);
  });
});
