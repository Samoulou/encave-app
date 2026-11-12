import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@/server/db';
import { WINERIES_TAG, wineryTag } from '@/lib/utils/cache-tags';
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
async function fetchPubliclyVisibleWineryBySlug(slug: string) {
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
}

/**
 * Cached 5 minutes. The wrapper is built per slug so the entry carries the
 * ENTITY tag `winery:{slug}` next to the listing tag (quality lot B3): a
 * change only this fiche displays (its wine list) purges this page alone.
 * The slug is part of the cache key through the key parts.
 */
export function getWineryBySlug(slug: string) {
  return unstable_cache(
    () => fetchPubliclyVisibleWineryBySlug(slug),
    // v3 (P-12 / L-117): payload gained the enrichment scalars (signatureGrapes
    // etc.). The bump prevents pre-deploy cache entries (missing signatureGrapes)
    // being served to the fiche, which reads `.length` — an undefined would
    // throw. v2 added the P-07 `wines` include for the same reason.
    ['winery-by-slug-v3', slug],
    {
      revalidate: 300,
      tags: [WINERIES_TAG, wineryTag(slug)],
    }
  )();
}

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
 * The caller's OWN winery, resolved from the session user — ONE lookup per
 * request (React.cache), shared by the dashboard layout, the pages, the
 * access guard and the owner-side queries. Each of them used to run its own
 * `db.winery.findUnique({ where: { userId } })` with a slightly different
 * select (3-4 round trips per dashboard request — audit A9).
 *
 * Scalars only, enough for every tenant gate and nav decision. It carries
 * `stripeAccountId`: SERVER-SIDE USE ONLY — never pass the object to a
 * client component, pick the fields you render.
 *
 * NOT a public query — the visibility filter does NOT apply here.
 */
export const getCurrentWinery = cache(async function getCurrentWinery(
  userId: string
) {
  return db.winery.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      stripeAccountId: true,
      stripeOnboardingComplete: true,
      stripeDetailsSubmitted: true,
    },
  });
});

export type CurrentWinery = NonNullable<
  Awaited<ReturnType<typeof getCurrentWinery>>
>;

/**
 * Get winery name by user ID (for dashboard).
 * Thin view over {@link getCurrentWinery} (same request-level lookup).
 */
export async function getWineryByUserId(userId: string) {
  const winery = await getCurrentWinery(userId);
  return winery ? { name: winery.name } : null;
}

/**
 * Winery id + name for the dashboard layout (P-10): the sidebar needs the id
 * to resolve the requests nav badge count. Thin view over
 * {@link getCurrentWinery} (same request-level lookup).
 */
export async function getWineryNavContext(userId: string) {
  const winery = await getCurrentWinery(userId);
  return winery ? { id: winery.id, name: winery.name } : null;
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
