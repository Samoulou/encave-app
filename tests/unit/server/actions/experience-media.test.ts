/**
 * Security regression (pre-launch audit, H2): deleteUploadedImage must
 * only ever pass to del() a blob of the caller's own winery folder. The
 * former `includes('experiences/{id}/')` test was satisfied by a query
 * string appended to another tenant's URL.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { del } = await import('@vercel/blob');
const { deleteUploadedImage } =
  await import('@/server/actions/experience-media');

const session: Session = {
  user: {
    id: 'owner-1',
    email: 'owner@test.ch',
    name: 'Owner',
    role: 'WINEMAKER',
    preferredLocale: 'FR',
    twoFactorEnabled: false,
    emailVerified: true,
  },
};

const HOST = 'https://store123.public.blob.vercel-storage.com';
const OWN_URL = `${HOST}/experiences/winery-1/1700000000-photo.jpg`;
const FOREIGN_URL = `${HOST}/experiences/winery-2/1700000000-photo.jpg`;

describe('deleteUploadedImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: 'winery-1',
    } as never);
  });

  it('returns UNAUTHORIZED without a session', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);

    const result = await deleteUploadedImage(OWN_URL);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('UNAUTHORIZED');
    expect(del).not.toHaveBeenCalled();
  });

  it("deletes a blob of the caller's own winery folder", async () => {
    const result = await deleteUploadedImage(OWN_URL);

    expect(result.success).toBe(true);
    expect(del).toHaveBeenCalledWith(OWN_URL);
  });

  it.each([
    ['another winery folder', FOREIGN_URL],
    ['a query-string smuggle', `${FOREIGN_URL}?experiences/winery-1/`],
    ['a fragment smuggle', `${FOREIGN_URL}#experiences/winery-1/`],
    ['a winery cover of another tenant', `${HOST}/wineries/user-9/cover.jpg`],
    ['path traversal', `${HOST}/experiences/winery-1/../winery-2/x.jpg`],
    ['a foreign host', 'https://evil.test/experiences/winery-1/x.jpg'],
    ['a bare pathname', 'experiences/winery-1/x.jpg'],
  ])('refuses %s with FORBIDDEN and never calls del()', async (_l, url) => {
    const result = await deleteUploadedImage(url);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
    expect(del).not.toHaveBeenCalled();
  });
});
