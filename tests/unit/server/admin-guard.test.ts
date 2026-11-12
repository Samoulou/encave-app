/**
 * Admin boundary (pre-launch audit, B2 + M1): one decision
 * (`checkAdminAccess`) behind both the server-action gate (`requireAdmin`)
 * and the page gate (`requireAdminPage`). Role alone is not enough — a
 * suspended admin, an admin without TOTP or an outlived session must be
 * refused at the boundary, not only by admin/layout.tsx (which server
 * actions and crafted RSC requests never render).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
  getCurrentUserSecurityState: vi.fn(),
  isCurrentAdminSessionExpired: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'fr'),
}));

// redirect()/notFound() throw in Next.js (they never return) — model that,
// otherwise the guard would run past its own refusal.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

const { auth, getCurrentUserSecurityState, isCurrentAdminSessionExpired } =
  await import('@/server/auth');
const { checkAdminAccess, requireAdmin } = await import('@/server/admin-guard');
const { requireAdminPage } = await import('@/server/admin-page-guard');

function sessionFor(role: Session['user']['role']): Session {
  return {
    user: {
      id: 'user-1',
      email: 'someone@encave.ch',
      name: 'Someone',
      role,
      preferredLocale: 'FR',
      twoFactorEnabled: true,
      emailVerified: true,
    },
  };
}

const healthy = { suspended: false, twoFactorEnabled: true };

describe('admin boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(sessionFor('ADMIN'));
    vi.mocked(getCurrentUserSecurityState).mockResolvedValue(healthy);
    vi.mocked(isCurrentAdminSessionExpired).mockResolvedValue(false);
  });

  describe('checkAdminAccess', () => {
    it('grants a TOTP-enrolled, non-suspended ADMIN with a fresh session', async () => {
      expect(await checkAdminAccess()).toEqual({ ok: true, adminId: 'user-1' });
    });

    it('denies an anonymous caller', async () => {
      vi.mocked(auth).mockResolvedValue(null);
      expect(await checkAdminAccess()).toEqual({
        ok: false,
        reason: 'UNAUTHENTICATED',
      });
    });

    it.each(['CLIENT', 'WINEMAKER'] as const)(
      'denies a %s without even reading the admin state',
      async (role) => {
        vi.mocked(auth).mockResolvedValue(sessionFor(role));
        expect(await checkAdminAccess()).toEqual({
          ok: false,
          reason: 'NOT_ADMIN',
        });
        expect(getCurrentUserSecurityState).not.toHaveBeenCalled();
      }
    );

    it('denies a suspended ADMIN', async () => {
      vi.mocked(getCurrentUserSecurityState).mockResolvedValue({
        suspended: true,
        twoFactorEnabled: true,
      });
      expect(await checkAdminAccess()).toEqual({
        ok: false,
        reason: 'SUSPENDED',
      });
    });

    it('denies an ADMIN who has not enrolled TOTP', async () => {
      vi.mocked(getCurrentUserSecurityState).mockResolvedValue({
        suspended: false,
        twoFactorEnabled: false,
      });
      expect(await checkAdminAccess()).toEqual({
        ok: false,
        reason: 'TOTP_REQUIRED',
      });
    });

    it('denies an ADMIN session past its 7 d window', async () => {
      vi.mocked(isCurrentAdminSessionExpired).mockResolvedValue(true);
      expect(await checkAdminAccess()).toEqual({
        ok: false,
        reason: 'SESSION_EXPIRED',
      });
    });

    it('fails closed when the user row cannot be read', async () => {
      vi.mocked(getCurrentUserSecurityState).mockResolvedValue(null);
      expect(await checkAdminAccess()).toEqual({
        ok: false,
        reason: 'UNAUTHENTICATED',
      });
    });
  });

  describe('requireAdmin (server actions)', () => {
    it('returns the admin id on success', async () => {
      expect(await requireAdmin()).toEqual({
        success: true,
        data: { adminId: 'user-1' },
      });
    });

    it.each([
      [
        'an anonymous caller',
        'UNAUTHORIZED',
        () => vi.mocked(auth).mockResolvedValue(null),
      ],
      [
        'a non-admin',
        'FORBIDDEN',
        () => vi.mocked(auth).mockResolvedValue(sessionFor('WINEMAKER')),
      ],
      [
        'a suspended admin',
        'FORBIDDEN',
        () =>
          vi.mocked(getCurrentUserSecurityState).mockResolvedValue({
            suspended: true,
            twoFactorEnabled: true,
          }),
      ],
      [
        'an admin without TOTP',
        'FORBIDDEN',
        () =>
          vi.mocked(getCurrentUserSecurityState).mockResolvedValue({
            suspended: false,
            twoFactorEnabled: false,
          }),
      ],
      [
        'an expired admin session',
        'UNAUTHORIZED',
        () => vi.mocked(isCurrentAdminSessionExpired).mockResolvedValue(true),
      ],
    ])('refuses %s with %s', async (_label, code, arrange) => {
      arrange();
      const result = await requireAdmin();
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe(code);
    });
  });

  describe('requireAdminPage (pages) — mirrors admin/layout.tsx', () => {
    it('lets a healthy admin through', async () => {
      await expect(requireAdminPage()).resolves.toEqual({ adminId: 'user-1' });
    });

    it('sends an anonymous caller to login, returning to /admin', async () => {
      vi.mocked(auth).mockResolvedValue(null);
      await expect(requireAdminPage()).rejects.toThrow(
        'REDIRECT:/fr/login?callbackUrl=/fr/admin'
      );
    });

    it('404s a logged-in non-admin', async () => {
      vi.mocked(auth).mockResolvedValue(sessionFor('CLIENT'));
      await expect(requireAdminPage()).rejects.toThrow('NOT_FOUND');
    });

    it('sends a suspended admin home', async () => {
      vi.mocked(getCurrentUserSecurityState).mockResolvedValue({
        suspended: true,
        twoFactorEnabled: true,
      });
      await expect(requireAdminPage()).rejects.toThrow(/^REDIRECT:\/fr$/);
    });

    it('sends an admin without TOTP to the setup page', async () => {
      vi.mocked(getCurrentUserSecurityState).mockResolvedValue({
        suspended: false,
        twoFactorEnabled: false,
      });
      await expect(requireAdminPage()).rejects.toThrow(
        'REDIRECT:/fr/admin-setup/2fa'
      );
    });

    it('sends an outlived session to the revocation route', async () => {
      vi.mocked(isCurrentAdminSessionExpired).mockResolvedValue(true);
      await expect(requireAdminPage()).rejects.toThrow(
        'REDIRECT:/api/auth/session-expired?locale=fr'
      );
    });
  });
});

/**
 * Structural guard: a new page under /admin that forgets the gate would
 * silently reopen B2 — fail the suite instead.
 */
describe('every /admin page calls requireAdminPage first', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');

  function collectPages(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return collectPages(full);
      return entry === 'page.tsx' ? [full] : [];
    });
  }

  const pages = collectPages(join(process.cwd(), 'src/app/[locale]/admin'));

  it('finds the admin pages', () => {
    expect(pages.length).toBeGreaterThanOrEqual(10);
  });

  it.each(pages)('%s', (file) => {
    const source = readFileSync(file, 'utf8');
    const start = source.indexOf('export default async function');
    expect(start, 'default export must be an async function').toBeGreaterThan(
      -1
    );
    const body = source.slice(start);
    const guardAt = body.indexOf('await requireAdminPage()');
    expect(guardAt, 'missing await requireAdminPage()').toBeGreaterThan(-1);
    // Nothing may be awaited (params, queries, translations) before the gate.
    const firstAwait = body.indexOf('await ');
    expect(firstAwait).toBe(guardAt);
  });
});
