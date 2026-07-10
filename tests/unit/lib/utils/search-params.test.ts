import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CATALOG_SORT,
  parseCatalogSort,
  parseDateKeyParam,
  parseExperienceTypes,
} from '@/lib/utils/search-params';

describe('parseExperienceTypes', () => {
  it('parses a comma-separated list', () => {
    expect(parseExperienceTypes('TASTING,CELLAR_VISIT')).toEqual([
      'TASTING',
      'CELLAR_VISIT',
    ]);
  });

  it('parses a repeated param (array form)', () => {
    expect(parseExperienceTypes(['TASTING', 'WORKSHOP'])).toEqual([
      'TASTING',
      'WORKSHOP',
    ]);
  });

  it('accepts the V3 types MEAL and EVENT (P-05 parser alignment)', () => {
    expect(parseExperienceTypes('MEAL,EVENT')).toEqual(['MEAL', 'EVENT']);
  });

  it('drops unknown values', () => {
    expect(parseExperienceTypes('TASTING,BOGUS,MEAL')).toEqual([
      'TASTING',
      'MEAL',
    ]);
  });

  it('returns empty for null/undefined/empty', () => {
    expect(parseExperienceTypes(null)).toEqual([]);
    expect(parseExperienceTypes(undefined)).toEqual([]);
    expect(parseExperienceTypes('')).toEqual([]);
  });
});

describe('parseCatalogSort', () => {
  it('defaults to next_availability (L-110)', () => {
    expect(DEFAULT_CATALOG_SORT).toBe('next_availability');
    expect(parseCatalogSort(null)).toBe('next_availability');
    expect(parseCatalogSort(undefined)).toBe('next_availability');
    expect(parseCatalogSort('bogus')).toBe('next_availability');
  });

  it('accepts every known sort', () => {
    expect(parseCatalogSort('relevance')).toBe('relevance');
    expect(parseCatalogSort('price_asc')).toBe('price_asc');
    expect(parseCatalogSort('price_desc')).toBe('price_desc');
    expect(parseCatalogSort('newest')).toBe('newest');
    expect(parseCatalogSort('distance')).toBe('distance');
    expect(parseCatalogSort('next_availability')).toBe('next_availability');
  });
});

describe('parseDateKeyParam', () => {
  it('accepts a valid YYYY-MM-DD key', () => {
    expect(parseDateKeyParam('2026-07-11')).toBe('2026-07-11');
  });

  it('drops malformed or impossible dates', () => {
    expect(parseDateKeyParam('2026-7-11')).toBeUndefined();
    expect(parseDateKeyParam('2026-02-31')).toBeUndefined();
    expect(parseDateKeyParam('tomorrow')).toBeUndefined();
    expect(parseDateKeyParam(null)).toBeUndefined();
    expect(parseDateKeyParam(undefined)).toBeUndefined();
  });
});
