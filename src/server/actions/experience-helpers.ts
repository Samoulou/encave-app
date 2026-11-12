import { revalidateTag } from 'next/cache';
import { db } from '@/server/db';
import {
  EXPERIENCES_TAG,
  EXPERIENCE_AVAILABILITY_TAG,
  eventParticipantsTag,
  experienceTag,
  wineryTag,
} from '@/lib/utils/cache-tags';

/**
 * Invalidate experience-related caches after a mutation that changes what
 * the LISTINGS show or which experiences exist (publish / unpublish /
 * archive / create / delete, title, price, cover, capacity…).
 *
 * P-06 (L-212): tags ONLY — every public read of experience data is
 * unstable_cache tagged 'experiences' (cards, fiche, related, featured,
 * sitemap slugs), and under ISR the tag also purges the Full Route
 * Cache of pages that consumed it. Never `revalidatePath` on a public
 * route.
 *
 * This is the BROAD invalidation: it purges the home, the catalogue, every
 * fiche and every winery page. A mutation that only moves availability or
 * only touches one fiche must use the two narrower helpers below instead
 * (quality lot, audit 2026-11-12 — a single slot edit used to cold-start
 * the whole public tree). When unsure, stay here: correctness first.
 *
 * The slugs are optional and only add the matching entity tags (already
 * covered by the broad ones — kept so call sites document what changed).
 */
export function invalidateExperienceCaches(
  winerySlug?: string,
  experienceSlug?: string
) {
  revalidateTag(EXPERIENCES_TAG);
  if (experienceSlug) revalidateTag(experienceTag(experienceSlug));
  if (winerySlug) revalidateTag(wineryTag(winerySlug));
}

/**
 * Availability-only invalidation: WHEN an experience can be booked changed
 * (weekly slots, occurrence closed / reopened / capacity / punctual date,
 * blocked dates), not what it is.
 *
 * Purges the fiche(s) of the touched experience(s) and the catalogue search
 * cache (next-availability badge, date filter, default sort — i.e. the home
 * and /experiences). Every other fiche and every winery page stays cached.
 */
export function invalidateExperienceAvailabilityCaches(
  experienceSlugs: string | readonly string[]
) {
  const slugs =
    typeof experienceSlugs === 'string' ? [experienceSlugs] : experienceSlugs;
  for (const slug of Array.from(new Set(slugs))) {
    if (slug) revalidateTag(experienceTag(slug));
  }
  revalidateTag(EXPERIENCE_AVAILABILITY_TAG);
}

/**
 * Detail-only invalidation of ONE collective event's participants: the
 * public grid of that experience and its fiche. No listing shows the
 * participants, so nothing else needs to be purged.
 */
export function invalidateEventParticipantsCache(
  experienceId: string,
  experienceSlug: string
) {
  revalidateTag(eventParticipantsTag(experienceId));
  revalidateTag(experienceTag(experienceSlug));
}

/**
 * Detail-only invalidation of ONE winery fiche: a change nothing but
 * `/wineries/[slug]` displays (e.g. its public wine list). Listings and
 * the other pages stay cached. Anything that can change a winery's public
 * VISIBILITY must keep using `invalidateWineryCaches` (broad).
 */
export function invalidateWineryDetailCache(winerySlug: string) {
  revalidateTag(wineryTag(winerySlug));
}

/**
 * Create a slug existence checker for experiences.
 *
 * The check is GLOBAL, not per winery: the DB constraint is
 * `@@unique([wineryId, slug])`, but the public fiche lives at
 * `/experiences/[slug]` and is resolved by slug alone. Two wineries naming
 * an offer "Dégustation découverte" used to get the same slug — one fiche
 * became unreachable and its card opened (and booked) the other winery.
 *
 * `excludeExperienceId` lets an edit keep its own slug.
 */
export function createExperienceSlugChecker(excludeExperienceId?: string) {
  return async (slug: string): Promise<boolean> => {
    const existing = await db.experience.findFirst({
      where: {
        slug,
        ...(excludeExperienceId && { id: { not: excludeExperienceId } }),
      },
      select: { id: true },
    });
    return !!existing;
  };
}
