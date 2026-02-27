import { unstable_cache } from 'next/cache';
import { db } from '@/server/db';

/**
 * Get all verified wineries, optionally filtered by commune.
 * Cached for 5 minutes, revalidated on winery updates.
 */
export const getVerifiedWineries = unstable_cache(
  async (commune?: string) => {
    return db.winery.findMany({
      where: {
        status: 'VERIFIED',
        ...(commune && { commune }),
      },
      include: {
        _count: {
          select: { experiences: { where: { status: 'PUBLISHED' } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  },
  ['verified-wineries'],
  {
    revalidate: 300, // 5 minutes
    tags: ['wineries'],
  }
);

/**
 * Get a single winery by slug.
 * Cached for 5 minutes per slug.
 */
export const getWineryBySlug = unstable_cache(
  async (slug: string) => {
    return db.winery.findUnique({
      where: { slug, status: 'VERIFIED' },
      include: {
        galleryImages: {
          orderBy: { order: 'asc' },
        },
      },
    });
  },
  ['winery-by-slug'],
  {
    revalidate: 300,
    tags: ['wineries'],
  }
);

/**
 * Get distinct communes from verified wineries.
 * Cached for 10 minutes (rarely changes).
 */
export const getDistinctCommunes = unstable_cache(
  async () => {
    const wineries = await db.winery.findMany({
      where: { status: 'VERIFIED' },
      select: { commune: true },
      distinct: ['commune'],
      orderBy: { commune: 'asc' },
    });
    return wineries.map((w) => w.commune);
  },
  ['distinct-communes'],
  {
    revalidate: 600, // 10 minutes
    tags: ['wineries'],
  }
);

/**
 * Get winery name by user ID (for dashboard).
 * Short cache, user-specific.
 */
export async function getWineryByUserId(userId: string) {
  return db.winery.findUnique({
    where: { userId },
    select: { name: true },
  });
}

/**
 * Get featured wineries for landing pages.
 * Cached for 5 minutes.
 */
export const getFeaturedWineries = unstable_cache(
  async (limit: number = 6) => {
    return db.winery.findMany({
      where: {
        status: 'VERIFIED',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
  ['featured-wineries'],
  {
    revalidate: 300, // 5 minutes
    tags: ['wineries'],
  }
);

/**
 * Get all verified winery slugs (for sitemap/static generation).
 * Cached for 1 hour.
 */
export const getAllVerifiedWinerySlugs = unstable_cache(
  async (): Promise<string[]> => {
    const wineries = await db.winery.findMany({
      where: { status: 'VERIFIED' },
      select: { slug: true },
    });
    return wineries.map((w) => w.slug);
  },
  ['all-winery-slugs'],
  {
    revalidate: 3600, // 1 hour
    tags: ['wineries'],
  }
);
