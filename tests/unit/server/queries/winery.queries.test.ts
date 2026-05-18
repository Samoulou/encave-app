import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

// Disable next/cache wrappers — execute the inner function directly.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

import { db } from '@/server/db';
import {
  getPubliclyVisibleWineries,
  getWineryBySlug,
  getDistinctCommunes,
  getPubliclyVisibleWinerySlugs,
} from '@/server/queries/winery.queries';
import { publiclyVisibleWineryWhere } from '@/lib/business-rules/winery-visibility';

/**
 * Helper that builds a complete winery row matching the include/select
 * shape used by `getPubliclyVisibleWineries` / `getWineryBySlug`.
 */
function fullVisibleWinery(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    slug: 'happy-winery',
    name: 'Happy Winery',
    status: 'VERIFIED',
    stripeOnboardingComplete: true,
    description: 'A real description with text.',
    latitude: 46.2,
    longitude: 7.4,
    galleryImages: [{ id: 'img-1' }],
    experiences: [{ status: 'PUBLISHED' }],
    _count: { experiences: 1 },
    ...overrides,
  };
}

describe('winery.queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPubliclyVisibleWineries', () => {
    it('applies the publicly-visible where clause and orders by name', async () => {
      vi.mocked(db.winery.findMany).mockResolvedValue([
        fullVisibleWinery(),
      ] as never);

      await getPubliclyVisibleWineries();

      expect(db.winery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining(publiclyVisibleWineryWhere),
          orderBy: { name: 'asc' },
        })
      );
    });

    it('combines the where clause with a commune filter when provided', async () => {
      vi.mocked(db.winery.findMany).mockResolvedValue([] as never);

      await getPubliclyVisibleWineries('Sion');

      const call = vi.mocked(db.winery.findMany).mock.calls[0]?.[0];
      expect(call?.where).toMatchObject({
        ...publiclyVisibleWineryWhere,
        commune: 'Sion',
      });
    });

    it('post-filters rows whose description is HTML-empty after strip', async () => {
      vi.mocked(db.winery.findMany).mockResolvedValue([
        fullVisibleWinery({ slug: 'ok', description: 'Real text' }),
        fullVisibleWinery({ slug: 'bad', description: '<p>   </p>' }),
      ] as never);

      const result = await getPubliclyVisibleWineries();

      expect(result.map((w) => w.slug)).toEqual(['ok']);
    });
  });

  describe('getWineryBySlug', () => {
    it('uses findFirst with the composite visibility where and returns the winery on match', async () => {
      const mockWinery = {
        ...fullVisibleWinery({ slug: 'test-winery' }),
        galleryImages: [{ id: 'img-1', url: 'u', order: 0 }],
      };
      vi.mocked(db.winery.findFirst).mockResolvedValue(mockWinery as never);

      const result = await getWineryBySlug('test-winery');

      expect(db.winery.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            slug: 'test-winery',
            ...publiclyVisibleWineryWhere,
          }),
        })
      );
      expect(result).toEqual(mockWinery);
    });

    it('returns null when the slug does not match a publicly visible winery', async () => {
      vi.mocked(db.winery.findFirst).mockResolvedValue(null);

      const result = await getWineryBySlug('non-existent');

      expect(result).toBeNull();
    });

    it('returns null when the description is HTML-empty (TS post-filter)', async () => {
      vi.mocked(db.winery.findFirst).mockResolvedValue(
        fullVisibleWinery({ description: '<p></p>' }) as never
      );

      const result = await getWineryBySlug('html-empty');

      expect(result).toBeNull();
    });
  });

  describe('getDistinctCommunes', () => {
    it('queries only publicly visible wineries and projects communes', async () => {
      vi.mocked(db.winery.findMany).mockResolvedValue([
        { commune: 'Sion' },
        { commune: 'Sierre' },
      ] as never);

      const result = await getDistinctCommunes();

      expect(db.winery.findMany).toHaveBeenCalledWith({
        where: publiclyVisibleWineryWhere,
        select: { commune: true },
        distinct: ['commune'],
        orderBy: { commune: 'asc' },
      });
      expect(result).toEqual(['Sion', 'Sierre']);
    });

    it('returns an empty array when no publicly visible winery exists', async () => {
      vi.mocked(db.winery.findMany).mockResolvedValue([] as never);

      const result = await getDistinctCommunes();

      expect(result).toEqual([]);
    });
  });

  describe('getPubliclyVisibleWinerySlugs', () => {
    it('returns slugs of every publicly visible winery', async () => {
      vi.mocked(db.winery.findMany).mockResolvedValue([
        { slug: 'a' },
        { slug: 'b' },
      ] as never);

      const result = await getPubliclyVisibleWinerySlugs();

      expect(db.winery.findMany).toHaveBeenCalledWith({
        where: publiclyVisibleWineryWhere,
        select: { slug: true },
      });
      expect(result).toEqual(['a', 'b']);
    });
  });
});
