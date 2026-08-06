import { revalidateTag } from 'next/cache';
import { db } from '@/server/db';

/**
 * Invalidate experience-related caches after mutations.
 *
 * P-06 (L-212): tag ONLY — every public read of experience data is
 * unstable_cache tagged 'experiences' (cards, fiche, related, featured,
 * sitemap slugs), and under ISR the tag also purges the Full Route
 * Cache of pages that consumed it. The old per-locale revalidatePath
 * fan-out (which silently missed /en) is gone. Params kept for call
 * sites and as an escape hatch if a page-level fallback is ever needed.
 */
export function invalidateExperienceCaches(
  _winerySlug?: string,
  _experienceSlug?: string
) {
  revalidateTag('experiences');
}

/**
 * Create a slug existence checker for a specific winery
 */
export function createExperienceSlugChecker(wineryId: string) {
  return async (slug: string): Promise<boolean> => {
    const existing = await db.experience.findUnique({
      where: { wineryId_slug: { wineryId, slug } },
      select: { id: true },
    });
    return !!existing;
  };
}
