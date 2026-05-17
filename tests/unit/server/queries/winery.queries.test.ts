import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { db } from '@/server/db';
import {
  getVerifiedWineries,
  getWineryBySlug,
  getDistinctCommunes,
} from '@/server/queries/winery.queries';

describe('winery.queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getVerifiedWineries', () => {
    it('returns only VERIFIED wineries', async () => {
      const mockWineries = [
        { id: '1', name: 'Test Winery', status: 'VERIFIED' },
      ];
      vi.mocked(db.winery.findMany).mockResolvedValue(mockWineries as never);

      await getVerifiedWineries();

      expect(db.winery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'VERIFIED' },
          orderBy: { name: 'asc' },
        })
      );
    });

    it('filters by commune when provided', async () => {
      vi.mocked(db.winery.findMany).mockResolvedValue([]);

      await getVerifiedWineries('Sion');

      expect(db.winery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'VERIFIED', commune: 'Sion' },
          orderBy: { name: 'asc' },
        })
      );
    });

    it('returns empty array when no wineries found', async () => {
      vi.mocked(db.winery.findMany).mockResolvedValue([]);

      const result = await getVerifiedWineries();

      expect(result).toEqual([]);
    });
  });

  describe('getWineryBySlug', () => {
    it('returns winery with gallery images for valid slug', async () => {
      const mockWinery = {
        id: '1',
        slug: 'test-winery',
        name: 'Test Winery',
        status: 'VERIFIED',
        galleryImages: [],
      };
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);

      const result = await getWineryBySlug('test-winery');

      expect(db.winery.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-winery', status: 'VERIFIED' },
        include: {
          galleryImages: { orderBy: { order: 'asc' } },
        },
      });
      expect(result).toEqual(mockWinery);
    });

    it('returns null for non-existent slug', async () => {
      vi.mocked(db.winery.findUnique).mockResolvedValue(null);

      const result = await getWineryBySlug('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getDistinctCommunes', () => {
    it('returns list of distinct communes from verified wineries', async () => {
      const mockWineries = [
        { commune: 'Sion' },
        { commune: 'Sierre' },
        { commune: 'Martigny' },
      ];
      vi.mocked(db.winery.findMany).mockResolvedValue(mockWineries as never);

      const result = await getDistinctCommunes();

      expect(db.winery.findMany).toHaveBeenCalledWith({
        where: { status: 'VERIFIED' },
        select: { commune: true },
        distinct: ['commune'],
        orderBy: { commune: 'asc' },
      });
      expect(result).toEqual(['Sion', 'Sierre', 'Martigny']);
    });

    it('returns empty array when no verified wineries exist', async () => {
      vi.mocked(db.winery.findMany).mockResolvedValue([]);

      const result = await getDistinctCommunes();

      expect(result).toEqual([]);
    });
  });
});
