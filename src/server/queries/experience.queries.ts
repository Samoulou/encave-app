import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@/server/db';
import {
  ExperienceType,
  ExperienceStatus,
  OccurrenceStatus,
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

/**
 * First BOOKABLE occurrence per experience in [from, to?] — shared by
 * the date prefilter (D3: a full slot is not a result) and the
 * next-availability sort (P-06 / L-207). "Bookable" composes the same
 * three predicates as the booking path: OPEN occurrence, no BlockedDate
 * on that day (D3 — derived at read), remaining capacity > 0 via
 * activeCapacityBookingWhere/resolveOccurrenceCapacity — never a
 * parallel reimplementation.
 *
 * 4 indexed reads, no per-experience N+1: occurrences [date,status],
 * blocked dates, seat groupBy [experienceId,date,timeSlot,status],
 * maxCapacity of the touched experiences.
 */
async function mapNextBookableOccurrences(
  from: Date,
  to: Date | undefined,
  experienceWhere: Prisma.ExperienceWhereInput
): Promise<Map<string, { date: Date; startTime: string }>> {
  const now = new Date();
  const dateWindow = { gte: from, ...(to !== undefined && { lte: to }) };

  const occurrences = await db.experienceOccurrence.findMany({
    where: {
      status: OccurrenceStatus.OPEN,
      date: dateWindow,
      experience: experienceWhere,
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

  const experienceIds = Array.from(
    new Set(occurrences.map((o) => o.experienceId))
  );

  const [blocked, seats, capacities] = await Promise.all([
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
    db.experience.findMany({
      where: { id: { in: experienceIds } },
      select: { id: true, maxCapacity: true },
    }),
  ]);

  const dayKey = (experienceId: string, date: Date) =>
    `${experienceId}|${date.toISOString().slice(0, 10)}`;
  const blockedKeys = new Set(
    blocked.map((b) => dayKey(b.experienceId, b.date))
  );
  const seatsBySlot = new Map(
    seats.map((row) => [
      `${dayKey(row.experienceId, row.date)}|${row.timeSlot}`,
      row._sum.guestCount ?? 0,
    ])
  );
  const maxCapacityById = new Map(
    capacities.map((exp) => [exp.id, exp.maxCapacity])
  );

  const next = new Map<string, { date: Date; startTime: string }>();
  for (const occurrence of occurrences) {
    if (next.has(occurrence.experienceId)) continue;
    if (blockedKeys.has(dayKey(occurrence.experienceId, occurrence.date))) {
      continue;
    }
    const capacity = resolveOccurrenceCapacity(
      occurrence.capacityOverride,
      maxCapacityById.get(occurrence.experienceId) ?? 0
    );
    const booked =
      seatsBySlot.get(
        `${dayKey(occurrence.experienceId, occurrence.date)}|${occurrence.startTime}`
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
 * P-06 (L-212): the unstable_cache wrapper is hoisted to module level —
 * params flow in as an ARGUMENT (part of the cache key automatically)
 * instead of being captured by a closure rebuilt on every call.
 */
const cachedSearch = unstable_cache(
  async (params: SearchParams): Promise<PaginatedSearchResult> => {
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
    };

    // Date window (P-05 / L-110 + P-06 / D3): keep experiences with a
    // BOOKABLE occurrence in the window — OPEN, not blacked out AND with
    // remaining capacity. Clamped to today (Zurich); full slots are no
    // longer listed only to disappoint on the fiche.
    let dateWindowIds: string[] | null = null;
    let prefilterBookable: Map<
      string,
      { date: Date; startTime: string }
    > | null = null;
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
        prefilterBookable = await mapNextBookableOccurrences(
          from,
          to,
          baseWhere
        );
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
  },
  ['search-experiences'],
  {
    revalidate: 120, // 2 minutes
    tags: ['experiences'],
  }
);

/**
 * Search experiences with filters and pagination.
 * Supports location-based proximity sorting.
 * Cached for 2 minutes to balance freshness with performance.
 */
export async function searchExperiences(
  params: SearchParams
): Promise<PaginatedSearchResult> {
  return cachedSearch(params);
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
 * Get a single experience by slug.
 * Cached for 5 minutes. Wrapped with React.cache for request deduplication.
 */
export const getExperienceBySlug = cache(
  unstable_cache(
    async (slug: string): Promise<ExperienceDetail | null> => {
      return db.experience.findFirst({
        where: {
          slug,
          status: ExperienceStatus.PUBLISHED,
          winery: publiclyVisibleWineryWhere,
        },
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
    },
    ['experience-by-slug'],
    {
      revalidate: 300, // 5 minutes
      tags: ['experiences'],
    }
  )
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
      // First try to get experiences from the same winery
      const sameWinery = await db.experience.findMany({
        where: {
          id: { not: experienceId },
          wineryId,
          status: ExperienceStatus.PUBLISHED,
          winery: publiclyVisibleWineryWhere,
        },
        include: {
          winery: {
            select: {
              name: true,
              slug: true,
              commune: true,
            },
          },
        },
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
        include: {
          winery: {
            select: {
              name: true,
              slug: true,
              commune: true,
            },
          },
        },
        take: remaining,
      });

      return [...sameWinery, ...sameType];
    },
    ['related-experiences'],
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
