import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/server/auth';
import { IMAGE_MAX_SIZE } from '@/lib/validators/image';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('@/server/db', () => ({ db: { winery: { findUnique: vi.fn() } } }));
vi.mock('@vercel/blob', () => ({ put: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { put } = await import('@vercel/blob');
const { uploadExperienceImage } =
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

const WINERY_ID = 'winery-1';
const BLOB = 'https://abc123.public.blob.vercel-storage.com';

function form(file?: File): FormData {
  const data = new FormData();
  if (file) data.set('file', file);
  return data;
}

function image(
  name = 'cave photo (1).jpg',
  type = 'image/jpeg',
  size = 1024
): File {
  return new File([new Uint8Array(size)], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(session);
  vi.mocked(db.winery.findUnique).mockResolvedValue({
    id: WINERY_ID,
    status: 'VERIFIED',
  } as never);
  vi.mocked(put).mockResolvedValue({
    url: `${BLOB}/experiences/${WINERY_ID}/1-cave_photo__1_.jpg`,
  } as never);
});

describe('uploadExperienceImage', () => {
  it('returns UNAUTHORIZED without a session', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await uploadExperienceImage(form(image()));

    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(put).not.toHaveBeenCalled();
  });

  it.each([
    ['no winery', null],
    ['a pending winery', { id: WINERY_ID, status: 'PENDING' }],
    ['a suspended winery', { id: WINERY_ID, status: 'SUSPENDED' }],
  ])('returns FORBIDDEN for %s', async (_, winery) => {
    vi.mocked(db.winery.findUnique).mockResolvedValue(winery as never);

    const result = await uploadExperienceImage(form(image()));

    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects a missing file', async () => {
    const result = await uploadExperienceImage(form());

    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects a file over the size limit', async () => {
    const result = await uploadExperienceImage(
      form(image('big.jpg', 'image/jpeg', IMAGE_MAX_SIZE + 1))
    );

    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(put).not.toHaveBeenCalled();
  });

  it.each(['image/svg+xml', 'image/gif', 'text/html', 'application/pdf'])(
    'rejects the %s content type',
    async (type) => {
      const result = await uploadExperienceImage(form(image('file.bin', type)));

      expect(result).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
      expect(put).not.toHaveBeenCalled();
    }
  );

  it("stores the image under the caller's own winery folder with a sanitised name", async () => {
    const result = await uploadExperienceImage(form(image()));

    expect(result).toEqual({
      success: true,
      data: { url: `${BLOB}/experiences/${WINERY_ID}/1-cave_photo__1_.jpg` },
    });
    const [pathname, , options] = vi.mocked(put).mock.calls[0] ?? [];
    // experiences/{wineryId}/{timestamp}-{sanitised name}: the prefix is what
    // create/updateExperience later accept as "owned by this winery".
    expect(pathname).toMatch(
      new RegExp(`^experiences/${WINERY_ID}/\\d+-cave_photo__1_\\.jpg$`)
    );
    expect(options).toEqual({ access: 'public', contentType: 'image/jpeg' });
  });

  it('neutralises path traversal in the file name', async () => {
    await uploadExperienceImage(
      form(image('../../other-winery/x.png', 'image/png'))
    );

    const [pathname] = vi.mocked(put).mock.calls[0] ?? [];
    expect(pathname).toMatch(new RegExp(`^experiences/${WINERY_ID}/\\d+-`));
    expect(
      String(pathname).slice(`experiences/${WINERY_ID}/`.length)
    ).not.toContain('/');
  });

  it('never throws: a storage failure becomes INTERNAL_ERROR', async () => {
    vi.mocked(put).mockRejectedValue(new Error('blob down'));

    const result = await uploadExperienceImage(form(image()));

    expect(result).toMatchObject({
      success: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });
});
