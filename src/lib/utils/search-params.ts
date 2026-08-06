import type { ExperienceType } from '@prisma/client';
import { EXPERIENCE_TYPE_OPTIONS } from '@/lib/validators/experience';
import { isDateKey } from '@/lib/utils/date-key';

/**
 * Catalogue URL-param parsers shared by the server page and the client
 * (P-05 / L-110). Single source of truth so the `type` whitelist and the
 * default sort can't drift between the two again (MEAL/EVENT were
 * missing client-side before P-05).
 */

export const CATALOG_SORT_VALUES = [
  'next_availability',
  'relevance',
  'price_asc',
  'price_desc',
  'newest',
  'distance',
] as const;

export type CatalogSort = (typeof CATALOG_SORT_VALUES)[number];

/** L-110: soonest bookable occurrence first is the catalogue default. */
export const DEFAULT_CATALOG_SORT: CatalogSort = 'next_availability';

const VALID_TYPE_VALUES = new Set<string>(
  EXPERIENCE_TYPE_OPTIONS.map((option) => option.value)
);

/** Parse a `type` param (comma-separated or repeated) — unknown values dropped. */
export function parseExperienceTypes(
  value: string | string[] | null | undefined
): ExperienceType[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : value.split(',');
  return raw.filter((candidate): candidate is ExperienceType =>
    VALID_TYPE_VALUES.has(candidate)
  );
}

/** Parse a `sort` param, falling back to the default catalogue sort. */
export function parseCatalogSort(
  value: string | null | undefined
): CatalogSort {
  const match = CATALOG_SORT_VALUES.find((sort) => sort === value);
  return match ?? DEFAULT_CATALOG_SORT;
}

/**
 * Parse a `quand` / `quand_fin` param: a valid "YYYY-MM-DD" calendar
 * key or nothing. Invalid keys (malformed or impossible dates) are
 * silently dropped — never forwarded to the DB layer.
 */
export function parseDateKeyParam(
  value: string | null | undefined
): string | undefined {
  if (!value || !isDateKey(value)) return undefined;
  return value;
}
