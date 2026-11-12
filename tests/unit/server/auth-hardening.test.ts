/**
 * P-16 / WS-G — pure logic of the P-14 gap closures (G-1 path matching,
 * G-3 session-age predicate). The hook wiring itself is exercised in
 * preview (real Google login, plan §5) — better-auth internals are not
 * mockable in a meaningful way here.
 */
import { describe, it, expect } from 'vitest';
import {
  isSecondFactorGapPath,
  isSessionCreationBlocked,
  isSessionPastRoleWindow,
  sessionWindowMsForRole,
  twoFactorAttemptsIdentifier,
} from '@/server/auth-hardening';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('sessionWindowMsForRole (L-153)', () => {
  it('caps ADMIN at 7 days, WINEMAKER at 90, CLIENT/default at 30', () => {
    expect(sessionWindowMsForRole('ADMIN')).toBe(7 * DAY_MS);
    expect(sessionWindowMsForRole('WINEMAKER')).toBe(90 * DAY_MS);
    expect(sessionWindowMsForRole('CLIENT')).toBe(30 * DAY_MS);
    expect(sessionWindowMsForRole(undefined)).toBe(30 * DAY_MS);
  });
});

describe('isSessionPastRoleWindow (G-3)', () => {
  const now = Date.UTC(2026, 6, 16, 12, 0, 0);

  it('an 8-day-old ADMIN session is past its window', () => {
    const createdAt = new Date(now - 8 * DAY_MS);
    expect(isSessionPastRoleWindow(createdAt, 'ADMIN', now)).toBe(true);
  });

  it('a 6-day-old ADMIN session is still valid', () => {
    const createdAt = new Date(now - 6 * DAY_MS);
    expect(isSessionPastRoleWindow(createdAt, 'ADMIN', now)).toBe(false);
  });

  it('the boundary itself is not expired (strictly greater)', () => {
    const createdAt = new Date(now - 7 * DAY_MS);
    expect(isSessionPastRoleWindow(createdAt, 'ADMIN', now)).toBe(false);
  });

  it('an 8-day-old WINEMAKER session is fine (90d window)', () => {
    const createdAt = new Date(now - 8 * DAY_MS);
    expect(isSessionPastRoleWindow(createdAt, 'WINEMAKER', now)).toBe(false);
  });

  it('accepts ISO strings (raw better-auth payloads)', () => {
    const createdAt = new Date(now - 31 * DAY_MS).toISOString();
    expect(isSessionPastRoleWindow(createdAt, 'CLIENT', now)).toBe(true);
  });
});

describe('isSecondFactorGapPath (G-1)', () => {
  it('covers the email-OTP sign-in and every OAuth callback', () => {
    expect(isSecondFactorGapPath('/sign-in/email-otp')).toBe(true);
    expect(isSecondFactorGapPath('/callback/google')).toBe(true);
    expect(isSecondFactorGapPath('/callback/apple')).toBe(true);
  });

  it('leaves the built-in matcher paths and everything else alone', () => {
    // /sign-in/email is the built-in twoFactor plugin's own matcher — the
    // gap plugin must not double-fire on it.
    expect(isSecondFactorGapPath('/sign-in/email')).toBe(false);
    expect(isSecondFactorGapPath('/two-factor/verify-totp')).toBe(false);
    expect(isSecondFactorGapPath('/sign-up/email')).toBe(false);
    expect(isSecondFactorGapPath('/change-email')).toBe(false);
  });
});

describe('isSessionCreationBlocked (audit M1 — central suspension gate)', () => {
  it('blocks a suspended user', () => {
    expect(isSessionCreationBlocked({ suspendedAt: new Date() })).toBe(true);
  });

  it('lets an active user through', () => {
    expect(isSessionCreationBlocked({ suspendedAt: null })).toBe(false);
  });

  it('fails closed when the user row is missing', () => {
    expect(isSessionCreationBlocked(null)).toBe(true);
    expect(isSessionCreationBlocked(undefined)).toBe(true);
  });
});

describe('twoFactorAttemptsIdentifier (better-auth 1.7 challenge contract)', () => {
  it('matches the key verify-totp consumes for a challenge', () => {
    // dist/plugins/two-factor/verify-two-factor.mjs: `2fa-attempts-${cookie}`
    expect(twoFactorAttemptsIdentifier('2fa-abc')).toBe('2fa-attempts-2fa-abc');
  });
});
