import { unstable_cache } from 'next/cache';
import { db } from '@/server/db';
import {
  isWineryPubliclyVisible,
  publiclyVisibleWineryWhere,
} from '@/lib/business-rules/winery-visibility';

/**
 * Select fragment with the minimum fields needed to run
 * `isWineryPubliclyVisible` as a TS post-filter.
 *
 * Used by listing / detail queries that return full winery entities.
 */
const VISIBILITY_SELECT = {
  status: true,
  stripeOnboardingComplete: true,
  description: true,
  latitude: true,
  longitude: true,
  coverPhoto: true,
  galleryImages: { select: { id: true } },
  experiences: {
    where: { status: 'PUBLISHED' as const },
    select: { status: true },
  },
} as const;

/**
 * Get all publicly visible wineries, optionally filtered by commune.
 *
 * "Publicly visible" = passes the 6 ENC-027 criteria
 * (status VERIFIED, KYC ok, photos, description, geocoding,
 * ≥1 PUBLISHED experience).
 *
 * Cached for 5 minutes, revalidated via tag `'wineries'`.
 */
export const getPubliclyVisibleWineries = unstable_cache(
  async (commune?: string) => {
    const wineries = await db.winery.findMany({
      where: {
        ...publiclyVisibleWineryWhere,
        ...(commune && { commune }),
      },
      include: {
        _count: {
          select: { experiences: { where: { status: 'PUBLISHED' } } },
        },
        // Extra fields needed by the TS post-filter on description.
        galleryImages: { select: { id: true } },
        experiences: {
          where: { status: 'PUBLISHED' },
          select: { status: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Belt-and-suspenders: filter out whitespace-only / HTML-empty
    // descriptions that pass the SQL `description: { not: '' }` filter
    // but fail the strip-tags + trim check.
    return wineries.filter((w) => isWineryPubliclyVisible(w));
  },
  ['publicly-visible-wineries'],
  {
    revalidate: 300, // 5 minutes
    tags: ['wineries'],
  }
);

/**
 * Get a single winery by slug if and only if it is publicly visible.
 *
 * Returns `null` when the winery is missing OR fails any visibility
 * criterion — drives the 404 on `/wineries/[slug]`.
 *
 * Note: switched from `findUnique` to `findFirst` because the where
 * clause is now compound (not just the slug).
 */
export const getWineryBySlug = unstable_cache(
  async (slug: string) => {
    const winery = await db.winery.findFirst({
      where: {
        slug,
        ...publiclyVisibleWineryWhere,
      },
      include: {
        galleryImages: {
          orderBy: { order: 'asc' },
        },
        // Public wine list (P-07 / L-064) — rendered only when the
        // TASTING_SHEET flag is ON (checked by the page, not here).
        wines: {
          where: { available: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            grapeVariety: true,
            vintage: true,
            price: true,
          },
        },
        // Needed by isWineryPubliclyVisible (the include above gives us
        // the full gallery, we only need ids — but reusing it avoids an
        // extra query).
        experiences: {
          where: { status: 'PUBLISHED' },
          select: { status: true },
        },
      },
    });

    if (!winery) {
      return null;
    }

    // Final TS check (description strip-tags + trim).
    if (!isWineryPubliclyVisible(winery)) {
      return null;
    }

    return winery;
  },
  // v2: payload shape changed in P-07 (wines include) — the version bump
  // prevents pre-deploy cache entries (no `wines` key) from being served
  // to code that reads it.
  ['winery-by-slug-v2'],
  {
    revalidate: 300,
    tags: ['wineries'],
  }
);

/**
 * Get distinct communes from publicly visible wineries.
 *
 * SQL-only filter (no TS post-filter): the volume of "almost visible"
 * caves with whitespace-only descriptions is negligible at MVP scale
 * and doesn't justify materialising every row.
 *
 * Cached for 10 minutes.
 */
export const getDistinctCommunes = unstable_cache(
  async () => {
    const wineries = await db.winery.findMany({
      where: publiclyVisibleWineryWhere,
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
 *
 * NOT a public query — visibility filter does NOT apply here.
 */
export async function getWineryByUserId(userId: string) {
  return db.winery.findUnique({
    where: { userId },
    select: { name: true },
  });
}

/**
 * Winery id + name for the dashboard layout (P-10): the sidebar needs the id
 * to resolve the requests nav badge count. Kept separate from
 * getWineryByUserId to avoid widening its shape for existing callers.
 */
export async function getWineryNavContext(userId: string) {
  return db.winery.findUnique({
    where: { userId },
    select: { id: true, name: true },
  });
}

/**
 * Get all publicly visible winery slugs (for sitemap / static generation).
 *
 * SQL-only filter: same trade-off as `getDistinctCommunes`.
 * Cached for 1 hour.
 */
export const getPubliclyVisibleWinerySlugs = unstable_cache(
  async (): Promise<string[]> => {
    const wineries = await db.winery.findMany({
      where: publiclyVisibleWineryWhere,
      select: { slug: true },
    });
    return wineries.map((w) => w.slug);
  },
  ['publicly-visible-winery-slugs'],
  {
    revalidate: 3600, // 1 hour
    tags: ['wineries'],
  }
);

// Used internally by VISIBILITY_SELECT typing — kept exported for tests
// that want to assert query shapes.
export { VISIBILITY_SELECT };
