import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SearchParams } from '@/server/queries/experience.queries';

// Note: These are unit tests for the query parameter building logic
// Integration tests with actual database would be in tests/integration/

describe('SearchParams type', () => {
  it('accepts valid search parameters', () => {
    const params: SearchParams = {
      search: 'wine',
      type: ['TASTING', 'CELLAR_VISIT'],
      commune: 'Sion',
      minPrice: 2000,
      maxPrice: 10000,
      capacity: 5,
      sort: 'price_asc',
    };

    expect(params.search).toBe('wine');
    expect(params.type).toHaveLength(2);
    expect(params.commune).toBe('Sion');
    expect(params.minPrice).toBe(2000);
    expect(params.maxPrice).toBe(10000);
    expect(params.capacity).toBe(5);
    expect(params.sort).toBe('price_asc');
  });

  it('accepts partial search parameters', () => {
    const params: SearchParams = {
      search: 'wine',
    };

    expect(params.search).toBe('wine');
    expect(params.type).toBeUndefined();
    expect(params.commune).toBeUndefined();
  });

  it('accepts empty search parameters', () => {
    const params: SearchParams = {};

    expect(params.search).toBeUndefined();
    expect(params.type).toBeUndefined();
    expect(params.sort).toBeUndefined();
  });

  it('accepts all valid sort options', () => {
    const sortOptions: SearchParams['sort'][] = [
      'relevance',
      'price_asc',
      'price_desc',
      'newest',
    ];

    sortOptions.forEach((sort) => {
      const params: SearchParams = { sort };
      expect(params.sort).toBe(sort);
    });
  });

  it('accepts all valid experience types', () => {
    const validTypes: SearchParams['type'] = [
      'TASTING',
      'CELLAR_VISIT',
      'WORKSHOP',
      'VINEYARD_TOUR',
      'FOOD_PAIRING',
    ];

    const params: SearchParams = { type: validTypes };
    expect(params.type).toHaveLength(5);
  });

  it('handles single type filter', () => {
    const params: SearchParams = {
      type: ['TASTING'],
    };

    expect(params.type).toHaveLength(1);
    expect(params.type![0]).toBe('TASTING');
  });

  it('handles price range with only min', () => {
    const params: SearchParams = {
      minPrice: 5000,
    };

    expect(params.minPrice).toBe(5000);
    expect(params.maxPrice).toBeUndefined();
  });

  it('handles price range with only max', () => {
    const params: SearchParams = {
      maxPrice: 10000,
    };

    expect(params.minPrice).toBeUndefined();
    expect(params.maxPrice).toBe(10000);
  });
});

describe('URL parameter parsing helpers', () => {
  // Helper function to parse types (similar to what's in the page component)
  function parseTypes(
    typeParam: string | null
  ): (
    | 'TASTING'
    | 'CELLAR_VISIT'
    | 'WORKSHOP'
    | 'VINEYARD_TOUR'
    | 'FOOD_PAIRING'
  )[] {
    if (!typeParam) return [];
    const validTypes = [
      'TASTING',
      'CELLAR_VISIT',
      'WORKSHOP',
      'VINEYARD_TOUR',
      'FOOD_PAIRING',
    ] as const;
    return typeParam
      .split(',')
      .filter((t): t is (typeof validTypes)[number] =>
        validTypes.includes(t as (typeof validTypes)[number])
      );
  }

  it('parses comma-separated types', () => {
    const result = parseTypes('TASTING,CELLAR_VISIT');
    expect(result).toEqual(['TASTING', 'CELLAR_VISIT']);
  });

  it('filters out invalid types', () => {
    const result = parseTypes('TASTING,INVALID,CELLAR_VISIT');
    expect(result).toEqual(['TASTING', 'CELLAR_VISIT']);
  });

  it('returns empty array for null', () => {
    const result = parseTypes(null);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    const result = parseTypes('');
    expect(result).toEqual([]);
  });

  // Helper function to parse sort
  function parseSort(
    sort: string | undefined
  ): 'relevance' | 'price_asc' | 'price_desc' | 'newest' {
    const validSorts = [
      'relevance',
      'price_asc',
      'price_desc',
      'newest',
    ] as const;
    if (sort && validSorts.includes(sort as (typeof validSorts)[number])) {
      return sort as (typeof validSorts)[number];
    }
    return 'relevance';
  }

  it('parses valid sort options', () => {
    expect(parseSort('price_asc')).toBe('price_asc');
    expect(parseSort('price_desc')).toBe('price_desc');
    expect(parseSort('newest')).toBe('newest');
    expect(parseSort('relevance')).toBe('relevance');
  });

  it('defaults to relevance for invalid sort', () => {
    expect(parseSort('invalid')).toBe('relevance');
    expect(parseSort(undefined)).toBe('relevance');
  });
});

// ---------------------------------------------------------------------------
// Date-window behavior (P-05 review fixes): today clamp, per-date blackout
// correlation, blackout-aware nextOccurrence pick.
// ---------------------------------------------------------------------------

vi.mock('@/server/db', () => ({
  db: {
    experience: { findMany: vi.fn(), count: vi.fn() },
    experienceOccurrence: { findMany: vi.fn() },
    blockedDate: { findMany: vi.fn() },
    booking: { groupBy: vi.fn() },
  },
}));

const { db } = await import('@/server/db');
const { searchExperiences } =
  await import('@/server/queries/experience.queries');
const { zurichTodayAsUTCDate } =
  await import('@/lib/business-rules/occurrence-expansion');

const WINERY = {
  id: 'w-1',
  name: 'Cave Test',
  slug: 'cave-test',
  commune: 'Sion',
  latitude: null,
  longitude: null,
};

describe('searchExperiences date window (P-05 / L-110, refonte P-06 / D3)', () => {
  /**
   * db.experience.findMany serves three call shapes in the new flow:
   * capacity lookup (select id+maxCapacity), sort candidates (select
   * id+createdAt) and card rows (full select). Route by select shape.
   */
  function routeExperienceFindMany(fixtures: {
    capacities?: Array<{ id: string; maxCapacity: number }>;
    candidates?: Array<{ id: string; createdAt: Date }>;
    rows?: unknown[];
  }) {
    vi.mocked(db.experience.findMany).mockImplementation((async (args: {
      select?: Record<string, unknown>;
    }) => {
      const select = args?.select ?? {};
      if ('maxCapacity' in select && !('title' in select)) {
        return fixtures.capacities ?? [];
      }
      if ('createdAt' in select && !('title' in select)) {
        return fixtures.candidates ?? [];
      }
      return fixtures.rows ?? [];
    }) as never);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.experience.findMany).mockResolvedValue([] as never);
    vi.mocked(db.experience.count).mockResolvedValue(0 as never);
    vi.mocked(db.experienceOccurrence.findMany).mockResolvedValue([] as never);
    vi.mocked(db.blockedDate.findMany).mockResolvedValue([] as never);
    vi.mocked(db.booking.groupBy).mockResolvedValue([] as never);
  });

  it('excludes an experience whose only OPEN occurrence sits on a blocked date', async () => {
    const day = new Date('2099-06-05T00:00:00.000Z');
    vi.mocked(db.experienceOccurrence.findMany).mockResolvedValue([
      {
        experienceId: 'exp-blocked',
        date: day,
        startTime: '10:00',
        capacityOverride: null,
      },
      {
        experienceId: 'exp-free',
        date: day,
        startTime: '10:00',
        capacityOverride: null,
      },
    ] as never);
    vi.mocked(db.blockedDate.findMany).mockResolvedValue([
      { experienceId: 'exp-blocked', date: day },
    ] as never);
    routeExperienceFindMany({
      capacities: [
        { id: 'exp-blocked', maxCapacity: 8 },
        { id: 'exp-free', maxCapacity: 8 },
      ],
      candidates: [],
      rows: [],
    });

    await searchExperiences({
      availableFrom: '2099-06-05',
      sort: 'newest',
    });

    expect(db.experience.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['exp-free'] } }),
      })
    );
  });

  it('excludes a FULL slot from the date window (P-06 / D3)', async () => {
    const day = new Date('2099-06-05T00:00:00.000Z');
    vi.mocked(db.experienceOccurrence.findMany).mockResolvedValue([
      {
        experienceId: 'exp-full',
        date: day,
        startTime: '10:00',
        capacityOverride: 4,
      },
      {
        experienceId: 'exp-open',
        date: day,
        startTime: '10:00',
        capacityOverride: null,
      },
    ] as never);
    vi.mocked(db.booking.groupBy).mockResolvedValue([
      {
        experienceId: 'exp-full',
        date: day,
        timeSlot: '10:00',
        _sum: { guestCount: 4 }, // override 4 -> 0 remaining
      },
      {
        experienceId: 'exp-open',
        date: day,
        timeSlot: '10:00',
        _sum: { guestCount: 7 }, // maxCapacity 8 -> 1 remaining
      },
    ] as never);
    routeExperienceFindMany({
      capacities: [
        { id: 'exp-full', maxCapacity: 8 },
        { id: 'exp-open', maxCapacity: 8 },
      ],
    });

    await searchExperiences({
      availableFrom: '2099-06-05',
      sort: 'newest',
    });

    expect(db.experience.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['exp-open'] } }),
      })
    );
  });

  it('clamps a past availableFrom to today (Zurich)', async () => {
    await searchExperiences({
      availableFrom: '2020-01-01',
      availableTo: '2099-12-31',
      sort: 'newest',
    });

    const args = vi.mocked(db.experienceOccurrence.findMany).mock.calls[0]?.[0];
    const gte = (args?.where?.date as { gte?: Date } | undefined)?.gte;
    expect(gte?.getTime()).toBe(zurichTodayAsUTCDate().getTime());
  });

  it('a window entirely in the past matches nothing without querying occurrences', async () => {
    const result = await searchExperiences({
      availableFrom: '2020-01-01',
      availableTo: '2020-01-02',
      sort: 'newest',
    });

    expect(db.experienceOccurrence.findMany).not.toHaveBeenCalled();
    expect(db.experience.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [] } }),
      })
    );
    expect(result.experiences).toEqual([]);
  });

  it('next_availability orders ids by soonest bookable occurrence and fetches only the page (P-06)', async () => {
    const blockedDay = new Date('2099-07-04T00:00:00.000Z');
    const freeDay = new Date('2099-07-11T00:00:00.000Z');
    const soonerDay = new Date('2099-07-05T00:00:00.000Z');
    const cardRow = (id: string) => ({
      id,
      title: `Exp ${id}`,
      slug: id,
      type: 'TASTING',
      duration: 60,
      price: 2500,
      maxCapacity: 8,
      coverPhoto: 'https://example.com/c.jpg',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      winery: WINERY,
    });

    vi.mocked(db.experienceOccurrence.findMany).mockResolvedValue([
      // exp-1: first occurrence blacked out -> bookable date is freeDay
      {
        experienceId: 'exp-1',
        date: blockedDay,
        startTime: '10:00',
        capacityOverride: null,
      },
      {
        experienceId: 'exp-2',
        date: soonerDay,
        startTime: '10:00',
        capacityOverride: null,
      },
      {
        experienceId: 'exp-1',
        date: freeDay,
        startTime: '10:00',
        capacityOverride: null,
      },
    ] as never);
    vi.mocked(db.blockedDate.findMany).mockResolvedValue([
      { experienceId: 'exp-1', date: blockedDay },
    ] as never);
    routeExperienceFindMany({
      capacities: [
        { id: 'exp-1', maxCapacity: 8 },
        { id: 'exp-2', maxCapacity: 8 },
      ],
      candidates: [
        { id: 'exp-1', createdAt: new Date('2026-01-01T00:00:00.000Z') },
        { id: 'exp-2', createdAt: new Date('2026-01-02T00:00:00.000Z') },
      ],
      rows: [cardRow('exp-1'), cardRow('exp-2')],
    });

    const result = await searchExperiences({ sort: 'next_availability' });

    // exp-2 (July 5) sorts before exp-1 (July 11 - July 4 is blacked out)
    expect(result.experiences.map((e) => e.id)).toEqual(['exp-2', 'exp-1']);
    expect(result.experiences[1]?.nextOccurrence?.date.getTime()).toBe(
      freeDay.getTime()
    );
  });
});
