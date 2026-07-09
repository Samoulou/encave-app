'use server';

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@/server/db';
import { ExperienceType, ExperienceStatus, Prisma } from '@prisma/client';
import type { CancellationPolicy } from '@prisma/client';
import { calculateDistance } from '@/lib/geo-utils';
import { getLocationById } from '@/lib/constants/locations';
import { publiclyVisibleWineryWhere } from '@/lib/business-rules/winery-visibility';

export interface SearchParams {
  search?: string;
  type?: ExperienceType[];
  commune?: string;
  minPrice?: number;
  maxPrice?: number;
  capacity?: number;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'distance';
  page?: number;
  limit?: number;
  // Location-based search params
  location?: string; // Location slug
  lat?: number; // Reference latitude
  lng?: number; // Reference longitude
}

export interface ExperienceSearchResult {
  id: string;
  title: string;
  slug: string;
  description: string;
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
    case 'relevance':
    default:
      // For relevance, we sort by newest as a fallback
      // In a real app, you might implement full-text search scoring
      return { createdAt: 'desc' };
  }
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * Search experiences with filters and pagination.
 * Supports location-based proximity sorting.
 * Cached for 2 minutes to balance freshness with performance.
 */
export async function searchExperiences(
  params: SearchParams
): Promise<PaginatedSearchResult> {
  // Create a cache key based on params
  const cacheKey = JSON.stringify(params);

  const cachedSearch = unstable_cache(
    async () => {
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

      const where: Prisma.ExperienceWhereInput = {
        status: ExperienceStatus.PUBLISHED,
        winery: wineryWhere,
        // Search filter
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
          include: {
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
          },
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

      // Standard search without location
      const [experiences, total] = await Promise.all([
        db.experience.findMany({
          where,
          include: {
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
          },
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
    ['search-experiences', cacheKey],
    {
      revalidate: 120, // 2 minutes
      tags: ['experiences'],
    }
  );

  return cachedSearch();
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
 * Get min/max price range for experiences.
 * Cached for 10 minutes. Wrapped with React.cache for request deduplication.
 */
export const getExperiencePriceRange = cache(
  unstable_cache(
    async (): Promise<{ min: number; max: number }> => {
      const result = await db.experience.aggregate({
        where: {
          status: ExperienceStatus.PUBLISHED,
          winery: publiclyVisibleWineryWhere,
        },
        _min: {
          price: true,
        },
        _max: {
          price: true,
        },
      });

      return {
        min: result._min.price ?? 0,
        max: result._max.price ?? 50000, // Default to 500 CHF
      };
    },
    ['experience-price-range'],
    {
      revalidate: 600, // 10 minutes
      tags: ['experiences'],
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
 * Get featured experiences for landing pages.
 * Cached for 5 minutes. Wrapped with React.cache for request deduplication.
 */
export const getFeaturedExperiences = cache(
  unstable_cache(
    async (limit: number = 6) => {
      return db.experience.findMany({
        where: {
          status: ExperienceStatus.PUBLISHED,
          winery: publiclyVisibleWineryWhere,
        },
        include: {
          winery: {
            select: {
              id: true,
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
    ['featured-experiences'],
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
