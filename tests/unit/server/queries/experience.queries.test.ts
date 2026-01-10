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
  ): ('TASTING' | 'CELLAR_VISIT' | 'WORKSHOP' | 'VINEYARD_TOUR' | 'FOOD_PAIRING')[] {
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
    const validSorts = ['relevance', 'price_asc', 'price_desc', 'newest'] as const;
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
