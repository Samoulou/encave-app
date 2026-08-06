import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db', () => ({
  db: {
    winery: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

import { db } from '@/server/db';
import { getNearbyWineryAlternatives } from '@/server/queries/winery-alternatives.queries';

const mockDb = vi.mocked(db);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getNearbyWineryAlternatives', () => {
  it('returns [] when the origin winery has no coordinates', async () => {
    mockDb.winery.findUnique.mockResolvedValue({
      latitude: null,
      longitude: null,
    } as never);

    const result = await getNearbyWineryAlternatives('origin-no-coords');

    expect(result).toEqual([]);
    expect(mockDb.winery.findMany).not.toHaveBeenCalled();
  });

  it('returns the nearest 3, sorted, with a distance label', async () => {
    mockDb.winery.findUnique.mockResolvedValue({
      latitude: 46.2,
      longitude: 7.35,
    } as never);
    mockDb.winery.findMany.mockResolvedValue([
      {
        name: 'Far',
        commune: 'X',
        slug: 'far',
        latitude: 47.5,
        longitude: 8.5,
      },
      {
        name: 'Near',
        commune: 'Y',
        slug: 'near',
        latitude: 46.21,
        longitude: 7.36,
      },
      {
        name: 'Mid',
        commune: 'Z',
        slug: 'mid',
        latitude: 46.4,
        longitude: 7.5,
      },
      {
        name: 'Farther',
        commune: 'W',
        slug: 'farther',
        latitude: 48,
        longitude: 9,
      },
    ] as never);

    const result = await getNearbyWineryAlternatives('origin-b', { limit: 3 });

    expect(result).toHaveLength(3);
    expect(result.map((winery) => winery.slug)).toEqual(['near', 'mid', 'far']);
    expect(result[0]?.distanceLabel).toBeTruthy();
  });
});
