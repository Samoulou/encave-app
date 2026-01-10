'use server';

import { db } from '@/server/db';
import { ExperienceType, ExperienceStatus, Prisma } from '@prisma/client';

export interface SearchParams {
  search?: string;
  type?: ExperienceType[];
  commune?: string;
  minPrice?: number;
  maxPrice?: number;
  capacity?: number;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
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
  };
}

function getOrderBy(
  sort?: string
): Prisma.ExperienceOrderByWithRelationInput | Prisma.ExperienceOrderByWithRelationInput[] {
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

export async function searchExperiences(
  params: SearchParams
): Promise<ExperienceSearchResult[]> {
  const where: Prisma.ExperienceWhereInput = {
    status: ExperienceStatus.PUBLISHED,
    winery: {
      status: 'VERIFIED',
    },
    availabilitySlots: {
      some: {
        isActive: true,
      },
    },
    // Search filter
    ...(params.search && {
      OR: [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { winery: { name: { contains: params.search, mode: 'insensitive' } } },
      ],
    }),
    // Type filter
    ...(params.type &&
      params.type.length > 0 && {
        type: { in: params.type },
      }),
    // Commune filter
    ...(params.commune && {
      winery: { commune: params.commune },
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

  const experiences = await db.experience.findMany({
    where,
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
    orderBy: getOrderBy(params.sort),
  });

  return experiences;
}

export async function getExperienceCommunes(): Promise<string[]> {
  const wineries = await db.winery.findMany({
    where: {
      status: 'VERIFIED',
      experiences: {
        some: {
          status: ExperienceStatus.PUBLISHED,
          availabilitySlots: {
            some: {
              isActive: true,
            },
          },
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
}

export async function getExperiencePriceRange(): Promise<{
  min: number;
  max: number;
}> {
  const result = await db.experience.aggregate({
    where: {
      status: ExperienceStatus.PUBLISHED,
      winery: {
        status: 'VERIFIED',
      },
      availabilitySlots: {
        some: {
          isActive: true,
        },
      },
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
}

export async function getExperienceBySlug(slug: string) {
  return db.experience.findFirst({
    where: {
      slug,
      status: ExperienceStatus.PUBLISHED,
      winery: {
        status: 'VERIFIED',
      },
    },
    include: {
      winery: {
        select: {
          id: true,
          name: true,
          slug: true,
          commune: true,
          address: true,
          coverPhoto: true,
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

export async function getRelatedExperiences(
  experienceId: string,
  wineryId: string,
  type: ExperienceType,
  limit: number = 3
) {
  // First try to get experiences from the same winery
  const sameWinery = await db.experience.findMany({
    where: {
      id: { not: experienceId },
      wineryId,
      status: ExperienceStatus.PUBLISHED,
      winery: { status: 'VERIFIED' },
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
      winery: { status: 'VERIFIED' },
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
}

export async function getAllPublishedExperienceSlugs() {
  const experiences = await db.experience.findMany({
    where: {
      status: ExperienceStatus.PUBLISHED,
      winery: { status: 'VERIFIED' },
    },
    select: { slug: true },
  });
  return experiences.map((e) => e.slug);
}
