/**
 * Security regression (pre-launch audit, B1 — confirmed live): the `role`
 * additional field must NEVER be settable from a request body. Without
 * `input: false`, better-auth copies it from /sign-up/email and
 * /update-user, so anyone could self-assign ADMIN.
 *
 * Exercised through better-auth's own input parser (the exact function
 * sign-up.mjs / update-user.mjs call with the request body) against the
 * REAL exported auth options — not a re-declaration of the config.
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

const { parseUserInput } = await import('better-auth/db');
const { auth } = await import('@/server/better-auth');

describe('better-auth user.additionalFields.role', () => {
  it('is declared input:false', () => {
    expect(auth.options.user?.additionalFields?.role).toMatchObject({
      input: false,
      defaultValue: 'CLIENT',
    });
  });

  it.each(['ADMIN', 'WINEMAKER'])(
    'sign-up: a body-supplied role %s is discarded for the CLIENT default',
    (role) => {
      const parsed = parseUserInput(auth.options, { role }, 'create');
      expect(parsed.role).toBe('CLIENT');
    }
  );

  it('sign-up: no role in the body still yields CLIENT', () => {
    const parsed = parseUserInput(auth.options, {}, 'create');
    expect(parsed.role).toBe('CLIENT');
  });

  it.each(['ADMIN', 'WINEMAKER'])(
    'update-user: a body-supplied role %s is rejected',
    (role) => {
      expect(() => parseUserInput(auth.options, { role }, 'update')).toThrow(
        /role is not allowed to be set/
      );
    }
  );

  it('update-user: legitimate fields still pass without touching role', () => {
    const parsed = parseUserInput(
      auth.options,
      { preferredLocale: 'DE' },
      'update'
    );
    expect(parsed).toEqual({ preferredLocale: 'DE' });
    expect('role' in parsed).toBe(false);
  });
});

describe('better-auth rate limit rules', () => {
  it('exempts the per-page-view session read from rate limiting', () => {
    expect(auth.options.rateLimit?.customRules?.['/get-session']).toBe(false);
  });

  it('keeps the brute-force rules on the credential endpoints', () => {
    const rules = auth.options.rateLimit?.customRules;
    expect(rules?.['/sign-in/email']).toEqual({ window: 900, max: 5 });
    expect(rules?.['/sign-in/email-otp']).toEqual({ window: 900, max: 5 });
    expect(rules?.['/sign-up/email']).toEqual({ window: 3600, max: 3 });
  });
});
