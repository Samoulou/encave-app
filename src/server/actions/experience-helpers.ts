import { revalidateTag, revalidatePath } from 'next/cache';
import { db } from '@/server/db';

/**
 * Invalidate experience-related caches after mutations
 */
export function invalidateExperienceCaches(winerySlug?: string, experienceSlug?: string) {
  // Invalidate the experiences list cache
  revalidateTag('experiences');

  // Revalidate the experiences listing page
  revalidatePath('/experiences');
  revalidatePath('/fr/experiences');
  revalidatePath('/de/experiences');

  // Revalidate specific experience page if slug is provided
  if (experienceSlug) {
    revalidatePath(`/experiences/${experienceSlug}`);
    revalidatePath(`/fr/experiences/${experienceSlug}`);
    revalidatePath(`/de/experiences/${experienceSlug}`);
  }

  // Revalidate winery page if slug is provided
  if (winerySlug) {
    revalidatePath(`/wineries/${winerySlug}`);
    revalidatePath(`/fr/wineries/${winerySlug}`);
    revalidatePath(`/de/wineries/${winerySlug}`);
  }
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
