import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@/server/db';
import {
  ExperienceType,
  ExperienceStatus,
  ExperiencePaymentMode,
  OccurrenceStatus,
  Locale,
  Prisma,
} from '@prisma/client';
import { addDays } from 'date-fns';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';
import { isDateKey } from '@/lib/utils/date-key';
import type { CancellationPolicy } from '@prisma/client';
import { calculateDistance } from '@/lib/geo-utils';
import { getLocationById } from '@/lib/constants/locations';
import { publiclyVisibleWineryWhere } from '@/lib/business-rules/winery-visibility';
import {
  EXPERIENCES_TAG,
  EXPERIENCE_AVAILABILITY_TAG,
  experienceTag,
} from '@/lib/utils/cache-tags';
import {
  activeCapacityBookingWhere,
  resolveOccurrenceCapacity,
} from '@/lib/business-rules/capacity';

export interface SearchParams {
  search?: string;
  type?: ExperienceType[];
  commune?: string;
  minPrice?: number;
  maxPrice?: number;
  capacity?: number;
  // Spoken-language filter (L-115): keep experiences whose `languages`
  // array contains the requested Locale.
  language?: Locale;
  sort?:
    | 'relevance'
    | 'price_asc'
    | 'price_desc'
    | 'newest'
    | 'distance'
    | 'next_availability';
  page?: number;
  limit?: number;
  // Date search (P-05 / L-110): YYYY-MM-DD calendar keys (Zurich).
  // Filters on the EXISTENCE of an OPEN occurrence in the window — the
  // remaining-capacity refinement is deferred to L-207/P-06 (a full slot
  // may list and show « complet » on the fiche).
  availableFrom?: string;
  availableTo?: string;
  // Location-based search params
  location?: string; // Location slug
  lat?: number; // Reference latitude
  lng?: number; // Reference longitude
}

export interface ExperienceSearchResult {
  id: string;
  title: string;
  slug: string;
  type: ExperienceType;
  duration: number;
  price: number;
  maxCapacity: number;
  coverPhoto: string;
  createdAt: Date;
  winery: {
    id: string;
    name: string;
    slug: string;
    commune: string;
    latitude: number | null;
    longitude: number | null;
  };
  // Distance from reference point (added when location search is used)
  distance?: number | null;
  // Next bookable occurrence (added for the next_availability sort)
  nextOccurrence?: { date: Date; startTime: string } | null;
}

export interface PaginatedSearchResult {
  experiences: ExperienceSearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  // Location search info
  locationName?: string;
  hasLocationSearch: boolean;
}

export interface ExperienceDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  type: ExperienceType;
  duration: number;
  price: number;
  minCapacity: number;
  maxCapacity: number;
  coverPhoto: string;
  status: ExperienceStatus;
  wineryId: string;
  // Payment mode (P-08): ON_SITE offers can carry a no-show card imprint.
  paymentMode: ExperiencePaymentMode;
  // Collective event (P-11): drives the organizer banner + participants grid.
  isCollective: boolean;
  // Experience-specific location fields
  address: string | null;
  city: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  winery: {
    id: string;
    name: string;
    slug: string;
    commune: string;
    address: string;
    coverPhoto: string | null;
    latitude: number | null;
    longitude: number | null;
    stripeOnboardingComplete: boolean;
    cancellationPolicy: CancellationPolicy;
    // No-show policy (P-08 / L-112) — displayed en clair on the fiche.
    noShowFeeEnabled: boolean;
    noShowFeeCents: number;
  };
  galleryImages: Array<{
    id: string;
    url: string;
    order: number;
    experienceId: string;
  }>;
  availabilitySlots: Array<{
    id: string;
    experienceId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }>;
}

function getOrderBy(
  sort?: string
):
  | Prisma.ExperienceOrderByWithRelationInput
  | Prisma.ExperienceOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return { price: 'asc' };
    case 'price_desc':
      return { price: 'desc' };
    case 'newest':
      return { createdAt: 'desc' };
    // next_availability is ordered in JS (Prisma can't order by a
    // relation MIN) — the DB order below is only a stable pre-sort.
    case 'next_availability':
    case 'relevance':
    default:
      // For relevance, we sort by newest as a fallback
      // In a real app, you might implement full-text search scoring
      return { createdAt: 'desc' };
  }
}

const DEFAULT_PAGE_SIZE = 20;

/** Fields shipped to the catalogue card — never `description @db.Text`
 * or unselected columns: the whole result set crosses the RSC boundary
 * to the client grid (P-06 / L-208). Coordinates stay: the desktop map
 * derives its pins from the cards. */
const SEARCH_CARD_SELECT = {
  id: true,
  title: true,
  slug: true,
  type: true,
  duration: true,
  price: true,
  maxCapacity: true,
  coverPhoto: true,
  createdAt: true,
  winery: {
    select: {
      id: true,
      name: true,
      slug: true,
      commune: true,
      latitude: true,
      longitude: true,
    },
  },
} satisfies Prisma.ExperienceSelect;

type NextOccurrence = { date: Date; startTime: string };

interface FirstOpenOccurrenceRow {
  experienceId: string;
  date: Date;
  startTime: string;
  capacityOverride: number | null;
}

const dayKeyOf = (experienceId: string, date: Date) =>
  `${experienceId}|${date.toISOString().slice(0, 10)}`;

/**
 * Exhaustive reference scan: EVERY open occurrence of the given experiences
 * in the window, walked in order until one is bookable. Correct for any
 * input, but it reads the whole window — it is now only the fallback of
 * {@link mapNextBookableOccurrences} for experiences whose soonest slot is
 * sold out (and the oracle of tests/db/next-bookable-occurrences.test.ts).
 */
export async function scanNextBookableOccurrences(
  from: Date,
  to: Date | undefined,
  maxCapacityById: ReadonlyMap<string, number>,
  now: Date = new Date()
): Promise<Map<string, NextOccurrence>> {
  const experienceIds = Array.from(maxCapacityById.keys());
  if (experienceIds.length === 0) return new Map();
  const dateWindow = { gte: from, ...(to !== undefined && { lte: to }) };

  const occurrences = await db.experienceOccurrence.findMany({
    where: {
      status: OccurrenceStatus.OPEN,
      date: dateWindow,
      experienceId: { in: experienceIds },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    select: {
      experienceId: true,
      date: true,
      startTime: true,
      capacityOverride: true,
    },
  });
  if (occurrences.length === 0) return new Map();

  const [blocked, seats] = await Promise.all([
    db.blockedDate.findMany({
      where: { date: dateWindow, experienceId: { in: experienceIds } },
      select: { experienceId: true, date: true },
    }),
    db.booking.groupBy({
      by: ['experienceId', 'date', 'timeSlot'],
      where: {
        experienceId: { in: experienceIds },
        date: dateWindow,
        ...activeCapacityBookingWhere(now),
      },
      _sum: { guestCount: true },
    }),
  ]);

  const blockedKeys = new Set(
    blocked.map((b) => dayKeyOf(b.experienceId, b.date))
  );
  const seatsBySlot = new Map(
    seats.map((row) => [
      `${dayKeyOf(row.experienceId, row.date)}|${row.timeSlot}`,
      row._sum.guestCount ?? 0,
    ])
  );

  const next = new Map<string, NextOccurrence>();
  for (const occurrence of occurrences) {
    if (next.has(occurrence.experienceId)) continue;
    if (blockedKeys.has(dayKeyOf(occurrence.experienceId, occurrence.date))) {
      continue;
    }
    const capacity = resolveOccurrenceCapacity(
      occurrence.capacityOverride,
      maxCapacityById.get(occurrence.experienceId) ?? 0
    );
    const booked =
      seatsBySlot.get(
        `${dayKeyOf(occurrence.experienceId, occurrence.date)}|${occurrence.startTime}`
      ) ?? 0;
    if (capacity - booked > 0) {
      next.set(occurrence.experienceId, {
        date: occurrence.date,
        startTime: occurrence.startTime,
      });
    }
  }
  return next;
}

/**
 * First BOOKABLE occurrence per experience in [from, to?] — shared by
 * the date prefilter (D3: a full slot is not a result) and the
 * next-availability sort (P-06 / L-207). "Bookable" composes the same
 * three predicates as the booking path: OPEN occurrence, no BlockedDate
 * on that day (D3 — derived at read), remaining capacity > 0 via
 * activeCapacityBookingWhere/resolveOccurrenceCapacity — never a
 * parallel reimplementation.
 *
 * Quality lot (audit A7): the previous shape loaded EVERY open occurrence
 * of the 92-day window into Node (≈17k rows per cache miss at 200
 * experiences) to keep one per experience. Now:
 *
 *  1. the matching experiences (id + maxCapacity) — one Prisma read;
 *  2. the SOONEST open, non-blacked-out occurrence of each, picked in SQL
 *     (`LATERAL … ORDER BY date, startTime LIMIT 1` — one index probe per
 *     experience on the (experienceId, date, startTime) unique, no row
 *     shipped but the winner);
 *  3. the seats of exactly those candidate slots, through the SHARED
 *     capacity predicate (Prisma groupBy — the SQL above deliberately does
 *     not re-implement "which bookings hold a seat");
 *  4. only for the experiences whose soonest slot is sold out: the
 *     exhaustive scan above, restricted to them.
 *
 * Same result as the exhaustive scan for every input (asserted on real
 * Postgres), a handful of rows in the common case.
 */
export async function mapNextBookableOccurrences(
  from: Date,
  to: Date | undefined,
  experienceWhere: Prisma.ExperienceWhereInput,
  now: Date = new Date()
): Promise<Map<string, NextOccurrence>> {
  const experiences = await db.experience.findMany({
    where: experienceWhere,
    select: { id: true, maxCapacity: true },
  });
  if (experiences.length === 0) return new Map();
  const maxCapacityById = new Map(
    experiences.map((exp) => [exp.id, exp.maxCapacity])
  );
  const experienceIds = experiences.map((exp) => exp.id);

  // Calendar keys, not Date params: `@db.Date` columns compare against a
  // DATE literal — a timestamp parameter would be cast in the session time
  // zone and could shift the window by a day.
  const fromKey = from.toISOString().slice(0, 10);
  const upperBound =
    to !== undefined
      ? Prisma.sql`AND occ."date" <= ${to.toISOString().slice(0, 10)}::date`
      : Prisma.empty;

  const candidates = await db.$queryRaw<FirstOpenOccurrenceRow[]>`
    SELECT e."id" AS "experienceId",
           o."date",
           o."startTime",
           o."capacityOverride"
    FROM unnest(${experienceIds}::text[]) AS e("id")
    CROSS JOIN LATERAL (
      SELECT occ."date", occ."startTime", occ."capacityOverride"
      FROM "experience_occurrences" occ
      WHERE occ."experienceId" = e."id"
        AND occ."status" = 'OPEN'::"OccurrenceStatus"
        AND occ."date" >= ${fromKey}::date
        ${upperBound}
        AND NOT EXISTS (
          SELECT 1
          FROM "blocked_dates" b
          WHERE b."experienceId" = occ."experienceId"
            AND b."date" = occ."date"
        )
      ORDER BY occ."date" ASC, occ."startTime" ASC
      LIMIT 1
    ) o
  `;
  if (candidates.length === 0) return new Map();

  // Seats of exactly the candidate slots — shared capacity predicate.
  const seats = await db.booking.groupBy({
    by: ['experienceId', 'date', 'timeSlot'],
    where: {
      AND: [
        activeCapacityBookingWhere(now),
        {
          OR: candidates.map((candidate) => ({
            experienceId: candidate.experienceId,
            date: candidate.date,
            timeSlot: candidate.startTime,
          })),
        },
      ],
    },
    _sum: { guestCount: true },
  });
  const seatsBySlot = new Map(
    seats.map((row) => [
      `${dayKeyOf(row.experienceId, row.date)}|${row.timeSlot}`,
      row._sum.guestCount ?? 0,
    ])
  );

  const next = new Map<string, NextOccurrence>();
  const soldOutFirst = new Map<string, number>();
  for (const candidate of candidates) {
    const maxCapacity = maxCapacityById.get(candidate.experienceId) ?? 0;
    const capacity = resolveOccurrenceCapacity(
      candidate.capacityOverride,
      maxCapacity
    );
    const booked =
      seatsBySlot.get(
        `${dayKeyOf(candidate.experienceId, candidate.date)}|${candidate.startTime}`
      ) ?? 0;
    if (capacity - booked > 0) {
      next.set(candidate.experienceId, {
        date: candidate.date,
        startTime: candidate.startTime,
      });
    } else {
      soldOutFirst.set(candidate.experienceId, maxCapacity);
    }
  }

  // Soonest slot sold out → the answer is further down the calendar: walk
  // the window for THOSE experiences only (rare, bounded by their count).
  if (soldOutFirst.size > 0) {
    const later = await scanNextBookableOccurrences(
      from,
      to,
      soldOutFirst,
      now
    );
    later.forEach((occurrence, experienceId) => {
      next.set(experienceId, occurrence);
    });
  }
  return next;
}

/**
 * The search itself — no caching here. `params` must already be
 * normalised (see {@link normalizeSearchParams}).
 */
async function runSearch(params: SearchParams): Promise<PaginatedSearchResult> {
  const page = params.page ?? 1;
  const limit = params.limit ?? DEFAULT_PAGE_SIZE;
  const skip = (page - 1) * limit;

  // Check if location-based search
  const hasLocationSearch = !!(
    params.location &&
    params.lat !== undefined &&
    params.lng !== undefined
  );
  const locationName = params.location
    ? getLocationById(params.location)?.name
    : undefined;

  const wineryWhere: Prisma.WineryWhereInput = {
    ...publiclyVisibleWineryWhere,
    ...(params.commune && { commune: params.commune }),
  };

  const baseWhere: Prisma.ExperienceWhereInput = {
    status: ExperienceStatus.PUBLISHED,
    winery: wineryWhere,
    // Search filter — served by the P-06 trigram GIN indexes.
    ...(params.search && {
      OR: [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        {
          winery: {
            name: { contains: params.search, mode: 'insensitive' },
          },
        },
        {
          winery: {
            commune: { contains: params.search, mode: 'insensitive' },
          },
        },
      ],
    }),
    // Type filter
    ...(params.type &&
      params.type.length > 0 && {
        type: { in: params.type },
      }),
    // Price range filters
    ...(params.minPrice !== undefined && {
      price: { gte: params.minPrice },
    }),
    ...(params.maxPrice !== undefined && {
      price: {
        ...(params.minPrice !== undefined ? { gte: params.minPrice } : {}),
        lte: params.maxPrice,
      },
    }),
    // Capacity filter
    ...(params.capacity !== undefined && {
      maxCapacity: { gte: params.capacity },
    }),
    // Spoken-language filter (L-115): shared by the list, the count,
    // the date prefilter and the next_availability sort — all derive
    // from baseWhere.
    ...(params.language && {
      languages: { has: params.language },
    }),
  };

  // Date window (P-05 / L-110 + P-06 / D3): keep experiences with a
  // BOOKABLE occurrence in the window — OPEN, not blacked out AND with
  // remaining capacity. Clamped to today (Zurich); full slots are no
  // longer listed only to disappoint on the fiche.
  let dateWindowIds: string[] | null = null;
  let prefilterBookable: Map<string, { date: Date; startTime: string }> | null =
    null;
  if (
    params.availableFrom &&
    isDateKey(params.availableFrom) &&
    (params.availableTo === undefined || isDateKey(params.availableTo))
  ) {
    const today = zurichTodayAsUTCDate();
    const rawFrom = new Date(`${params.availableFrom}T00:00:00.000Z`);
    const from = rawFrom.getTime() > today.getTime() ? rawFrom : today;
    const to = new Date(
      `${params.availableTo ?? params.availableFrom}T00:00:00.000Z`
    );
    if (to.getTime() < from.getTime()) {
      dateWindowIds = [];
    } else {
      prefilterBookable = await mapNextBookableOccurrences(from, to, baseWhere);
      dateWindowIds = Array.from(prefilterBookable.keys());
    }
  }

  const where: Prisma.ExperienceWhereInput = {
    ...baseWhere,
    ...(dateWindowIds !== null && { id: { in: dateWindowIds } }),
  };

  // For location-based search, we fetch all matching results and sort in JS
  // This is more efficient for small datasets (<100 wineries)
  if (
    hasLocationSearch &&
    params.lat !== undefined &&
    params.lng !== undefined
  ) {
    const refLat = params.lat;
    const refLng = params.lng;

    // Fetch all matching experiences with coordinates
    const allExperiences = await db.experience.findMany({
      where,
      select: SEARCH_CARD_SELECT,
    });

    // Calculate distances and sort
    const experiencesWithDistance = allExperiences.map((exp) => {
      const distance =
        exp.winery.latitude != null && exp.winery.longitude != null
          ? calculateDistance(
              refLat,
              refLng,
              exp.winery.latitude,
              exp.winery.longitude
            )
          : null;
      return { ...exp, distance };
    });

    // Sort by distance (nulls last)
    experiencesWithDistance.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    // Apply pagination
    const total = experiencesWithDistance.length;
    const paginatedExperiences = experiencesWithDistance.slice(
      skip,
      skip + limit
    );

    return {
      experiences: paginatedExperiences,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      locationName,
      hasLocationSearch: true,
    };
  }

  // Next-availability sort (P-05 / L-110, reworked P-06 / L-207): the
  // order comes from the bookable-occurrence map over a 3-month
  // horizon (the materialization window); only IDS are sorted and
  // sliced — the full rows of the page are fetched afterwards. No
  // more loading every matching row to sort in JS.
  if (params.sort === 'next_availability') {
    // With an active date filter, sort INSIDE the user's window using
    // the prefilter's map — no second occurrence scan, and no sorting
    // by a slot outside the window the user asked for. Otherwise the
    // horizon is the 3-month materialization window.
    const today = zurichTodayAsUTCDate();
    const candidatesPromise = db.experience.findMany({
      where,
      select: { id: true, createdAt: true },
    });
    const [candidates, bookable] = await Promise.all([
      candidatesPromise,
      prefilterBookable !== null
        ? Promise.resolve(prefilterBookable)
        : mapNextBookableOccurrences(today, addDays(today, 92), where),
    ]);

    const ordered = [...candidates].sort((a, b) => {
      const nextA = bookable.get(a.id) ?? null;
      const nextB = bookable.get(b.id) ?? null;
      if (nextA === null && nextB === null) {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      if (nextA === null) return 1;
      if (nextB === null) return -1;
      return (
        nextA.date.getTime() - nextB.date.getTime() ||
        nextA.startTime.localeCompare(nextB.startTime)
      );
    });

    const total = ordered.length;
    const pageIds = ordered.slice(skip, skip + limit).map((c) => c.id);
    const rows = await db.experience.findMany({
      where: { id: { in: pageIds } },
      select: SEARCH_CARD_SELECT,
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));

    return {
      experiences: pageIds.flatMap((id) => {
        const row = rowById.get(id);
        if (!row) return [];
        return [
          {
            ...row,
            distance: undefined,
            nextOccurrence: bookable.get(id) ?? null,
          },
        ];
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasLocationSearch: false,
    };
  }

  // Standard search without location
  const [experiences, total] = await Promise.all([
    db.experience.findMany({
      where,
      select: SEARCH_CARD_SELECT,
      orderBy: getOrderBy(params.sort),
      skip,
      take: limit,
    }),
    db.experience.count({ where }),
  ]);

  return {
    experiences: experiences.map((exp) => ({
      ...exp,
      distance: undefined,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasLocationSearch: false,
  };
}

const SEARCH_CACHE_SECONDS = 120; // 2 minutes

/**
 * P-06 (L-212): the unstable_cache wrappers are hoisted to module level —
 * params flow in as an ARGUMENT (part of the cache key automatically)
 * instead of being captured by a closure rebuilt on every call.
 *
 * Two wrappers because tags are static per wrapper (quality lot B3): a
 * search whose RESULT depends on availability (date filter, or the
 * next-availability sort that also feeds the cards' badge) additionally
 * carries `experiences:availability`, the tag fired by slot / occurrence /
 * blocked-date edits. A plain listing (the home's featured cards, price or
 * newest sort) does not — an availability edit leaves it cached.
 */
const cachedSearch = unstable_cache(runSearch, ['search-experiences'], {
  revalidate: SEARCH_CACHE_SECONDS,
  tags: [EXPERIENCES_TAG],
});
const cachedAvailabilitySearch = unstable_cache(
  runSearch,
  ['search-experiences-availability'],
  {
    revalidate: SEARCH_CACHE_SECONDS,
    tags: [EXPERIENCES_TAG, EXPERIENCE_AVAILABILITY_TAG],
  }
);

/** ~110 m — far below the precision of a "nearest wineries" ordering. */
const COORDINATE_DECIMALS = 3;

function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * Canonical form of the search params (quality lot B6) — the object IS the
 * cache key, so equivalent requests must serialise identically:
 *  - fixed key order, `undefined` dropped, defaults materialised
 *    (`{}` and `{ page: 1 }` used to be two entries);
 *  - free text trimmed, inner whitespace collapsed, lower-cased (the SQL
 *    match is case-insensitive);
 *  - type list de-duplicated and sorted;
 *  - coordinates rounded (a raw GPS fix made every key unique).
 */
export function normalizeSearchParams(params: SearchParams): SearchParams {
  const search = params.search?.trim().replace(/\s+/g, ' ').toLowerCase();
  const commune = params.commune?.trim();
  const type =
    params.type && params.type.length > 0
      ? Array.from(new Set(params.type)).sort()
      : undefined;
  const page = Math.max(1, Math.trunc(params.page ?? 1) || 1);
  const limit = Math.max(1, Math.trunc(params.limit ?? DEFAULT_PAGE_SIZE) || 1);

  const normalized: SearchParams = {
    ...(search ? { search } : {}),
    ...(type ? { type } : {}),
    ...(commune ? { commune } : {}),
    ...(params.minPrice !== undefined ? { minPrice: params.minPrice } : {}),
    ...(params.maxPrice !== undefined ? { maxPrice: params.maxPrice } : {}),
    ...(params.capacity !== undefined ? { capacity: params.capacity } : {}),
    ...(params.language ? { language: params.language } : {}),
    ...(params.sort ? { sort: params.sort } : {}),
    page,
    limit,
    ...(params.availableFrom ? { availableFrom: params.availableFrom } : {}),
    ...(params.availableTo ? { availableTo: params.availableTo } : {}),
    ...(params.location ? { location: params.location } : {}),
    ...(params.lat !== undefined ? { lat: roundCoordinate(params.lat) } : {}),
    ...(params.lng !== undefined ? { lng: roundCoordinate(params.lng) } : {}),
  };
  return normalized;
}

/** True when the result set or its ordering depends on live availability. */
function dependsOnAvailability(params: SearchParams): boolean {
  return (
    params.sort === 'next_availability' || params.availableFrom !== undefined
  );
}

/**
 * Search experiences with filters and pagination.
 * Supports location-based proximity sorting.
 *
 * Cached for 2 minutes — EXCEPT free-text searches, which bypass the
 * persistent cache: a text query is unbounded in cardinality (every
 * keystroke variant would write its own entry) and almost never repeats,
 * while the trigram indexes keep it cheap. The public action stays
 * rate-limited per IP.
 */
export async function searchExperiences(
  params: SearchParams
): Promise<PaginatedSearchResult> {
  const normalized = normalizeSearchParams(params);
  if (normalized.search !== undefined) {
    return runSearch(normalized);
  }
  return dependsOnAvailability(normalized)
    ? cachedAvailabilitySearch(normalized)
    : cachedSearch(normalized);
}

/**
 * Get distinct communes that have published experiences.
 * Cached for 10 minutes. Wrapped with React.cache for request deduplication.
 */
export const getExperienceCommunes = cache(
  unstable_cache(
    async (): Promise<string[]> => {
      const wineries = await db.winery.findMany({
        where: {
          ...publiclyVisibleWineryWhere,
          experiences: {
            some: {
              status: ExperienceStatus.PUBLISHED,
            },
          },
        },
        select: {
          commune: true,
        },
        distinct: ['commune'],
        orderBy: {
          commune: 'asc',
        },
      });

      return wineries.map((w) => w.commune);
    },
    ['experience-communes'],
    {
      revalidate: 600, // 10 minutes
      tags: ['experiences', 'wineries'],
    }
  )
);

/**
 * Latest published experiences for the 404 page.
 *
 * Next renders the `[locale]/not-found` boundary into the payload of EVERY
 * route under the segment, so its data must be cached: the previous
 * uncached read cost one DB query per dynamic request (dashboard,
 * checkout, admin…) and per ISR regeneration.
 */
export const getNotFoundSuggestions = cache(
  unstable_cache(
    async (): Promise<
      Array<{ id: string; title: string; slug: string; wineryName: string }>
    > => {
      const experiences = await db.experience.findMany({
        where: {
          status: ExperienceStatus.PUBLISHED,
          winery: publiclyVisibleWineryWhere,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          winery: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
      });

      return experiences.map((exp) => ({
        id: exp.id,
        title: exp.title,
        slug: exp.slug,
        wineryName: exp.winery.name,
      }));
    },
    ['not-found-suggestions'],
    {
      revalidate: 600,
      tags: ['experiences', 'wineries'],
    }
  )
);

async function fetchExperienceBySlug(
  slug: string
): Promise<ExperienceDetail | null> {
  return db.experience.findFirst({
    where: {
      slug,
      status: ExperienceStatus.PUBLISHED,
      winery: publiclyVisibleWineryWhere,
    },
    // Slugs are only unique per winery in the DB: resolve legacy
    // duplicates deterministically (the oldest keeps the URL).
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      type: true,
      duration: true,
      price: true,
      minCapacity: true,
      maxCapacity: true,
      coverPhoto: true,
      status: true,
      wineryId: true,
      paymentMode: true,
      isCollective: true,
      // Experience-specific location fields
      address: true,
      city: true,
      zipCode: true,
      latitude: true,
      longitude: true,
      winery: {
        select: {
          id: true,
          name: true,
          slug: true,
          commune: true,
          address: true,
          coverPhoto: true,
          latitude: true,
          longitude: true,
          stripeOnboardingComplete: true,
          cancellationPolicy: true,
          noShowFeeEnabled: true,
          noShowFeeCents: true,
        },
      },
      galleryImages: {
        orderBy: { order: 'asc' },
      },
      availabilitySlots: {
        where: { isActive: true },
        orderBy: { dayOfWeek: 'asc' },
      },
    },
  });
}

/**
 * Get a single experience by slug.
 * Cached for 5 minutes. Wrapped with React.cache for request deduplication.
 *
 * The wrapper is built per slug so the entry carries the ENTITY tag
 * `experience:{slug}` next to the listing tag (quality lot B3): a slot,
 * occurrence or blocked-date edit purges this fiche alone instead of every
 * public page. The slug is part of the cache key through the key parts.
 */
export const getExperienceBySlug = cache(
  (slug: string): Promise<ExperienceDetail | null> =>
    unstable_cache(
      () => fetchExperienceBySlug(slug),
      // v3 (P-11 / L-101): payload gained isCollective (fiche branches on it) —
      // the bump prevents pre-deploy cache entries (missing it) being served.
      // v2 (P-12 / L-112): added paymentMode + winery no-show fields.
      ['experience-by-slug-v3', slug],
      {
        revalidate: 300, // 5 minutes
        tags: [EXPERIENCES_TAG, experienceTag(slug)],
      }
    )()
);

/**
 * Get related experiences (same winery or same type).
 * Cached for 5 minutes. Wrapped with React.cache for request deduplication.
 */
export const getRelatedExperiences = cache(
  unstable_cache(
    async (
      experienceId: string,
      wineryId: string,
      type: ExperienceType,
      limit: number = 3
    ) => {
      // P-16 (WS-F / L-208): exactly the ExperienceCard fields — the old
      // `include` dragged `description` (multi-KB rich text) into the
      // cache entry of every fiche for cards that never render it.
      const cardSelect = {
        id: true,
        title: true,
        slug: true,
        type: true,
        duration: true,
        price: true,
        maxCapacity: true,
        coverPhoto: true,
        winery: {
          select: {
            name: true,
            slug: true,
            commune: true,
          },
        },
      } as const;

      // First try to get experiences from the same winery
      const sameWinery = await db.experience.findMany({
        where: {
          id: { not: experienceId },
          wineryId,
          status: ExperienceStatus.PUBLISHED,
          winery: publiclyVisibleWineryWhere,
        },
        select: cardSelect,
        take: limit,
      });

      // If we have enough, return them
      if (sameWinery.length >= limit) {
        return sameWinery;
      }

      // Otherwise, fill with same type from other wineries
      const remaining = limit - sameWinery.length;
      const sameType = await db.experience.findMany({
        where: {
          id: { not: experienceId },
          wineryId: { not: wineryId },
          type,
          status: ExperienceStatus.PUBLISHED,
          winery: publiclyVisibleWineryWhere,
        },
        select: cardSelect,
        take: remaining,
      });

      return [...sameWinery, ...sameType];
    },
    // v2 (P-16 / L-208): payload slimmed to the card fields.
    ['related-experiences-v2'],
    {
      revalidate: 300, // 5 minutes
      tags: ['experiences'],
    }
  )
);

/**
 * Get published experiences for a specific winery.
 * Cached for 5 minutes. Wrapped with React.cache for request deduplication.
 */
export const getExperiencesByWineryId = cache(
  unstable_cache(
    async (wineryId: string, limit: number = 6) => {
      return db.experience.findMany({
        where: {
          wineryId,
          status: ExperienceStatus.PUBLISHED,
          winery: publiclyVisibleWineryWhere,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          duration: true,
          price: true,
          coverPhoto: true,
          winery: {
            select: {
              name: true,
              slug: true,
              commune: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    },
    ['experiences-by-winery'],
    {
      revalidate: 300, // 5 minutes
      tags: ['experiences'],
    }
  )
);

/**
 * Get all published experience slugs (for sitemap/static generation).
 * Cached for 1 hour. Wrapped with React.cache for request deduplication.
 */
export const getAllPublishedExperienceSlugs = cache(
  unstable_cache(
    async () => {
      const experiences = await db.experience.findMany({
        where: {
          status: ExperienceStatus.PUBLISHED,
          winery: publiclyVisibleWineryWhere,
        },
        select: { slug: true },
      });
      return experiences.map((e) => e.slug);
    },
    ['all-experience-slugs'],
    {
      revalidate: 3600, // 1 hour
      tags: ['experiences'],
    }
  )
);
