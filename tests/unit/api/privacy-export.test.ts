/**
 * GET /api/privacy/export — access gates (nLPD). The payload itself is
 * covered by tests/db/privacy-nlpd.test.ts (buildPrivacyExport).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('@/server/services/privacy-export.service', () => ({
  buildPrivacyExport: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { auth } = await import('@/server/auth');
const { buildPrivacyExport } =
  await import('@/server/services/privacy-export.service');
const { GET } = await import('@/app/api/privacy/export/route');

function sessionWith(emailVerified: boolean) {
  return {
    user: {
      id: 'user-1',
      email: 'jeanne@example.ch',
      name: 'Jeanne',
      role: 'CLIENT',
      preferredLocale: 'FR',
      twoFactorEnabled: false,
      emailVerified,
    },
  } as never;
}

describe('GET /api/privacy/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is 401 without a session', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(buildPrivacyExport).not.toHaveBeenCalled();
  });

  it('is 403 for an UNVERIFIED email (rows are matched by email alone)', async () => {
    vi.mocked(auth).mockResolvedValue(sessionWith(false));

    const res = await GET();

    expect(res.status).toBe(403);
    expect(buildPrivacyExport).not.toHaveBeenCalled();
  });

  it('returns the export of the SESSION user as a private download', async () => {
    vi.mocked(auth).mockResolvedValue(sessionWith(true));
    vi.mocked(buildPrivacyExport).mockResolvedValue({
      exportedAt: '2026-11-12T00:00:00.000Z',
      subject: { user: { id: 'user-1' } },
    } as never);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(buildPrivacyExport).toHaveBeenCalledWith('user-1');
    expect(res.headers.get('content-disposition')).toContain(
      'encave-data-user-1.json'
    );
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toMatchObject({
      subject: { user: { id: 'user-1' } },
    });
  });

  it('is 404 when the user row no longer exists', async () => {
    vi.mocked(auth).mockResolvedValue(sessionWith(true));
    vi.mocked(buildPrivacyExport).mockResolvedValue(null);

    expect((await GET()).status).toBe(404);
  });

  it('is 500 (never a leak of internals) when the export fails', async () => {
    vi.mocked(auth).mockResolvedValue(sessionWith(true));
    vi.mocked(buildPrivacyExport).mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Export failed' });
  });
});
