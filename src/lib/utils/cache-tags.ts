/**
 * Cache tag names of the public read layer (quality lot, audit 2026-11-12).
 *
 * Three levels, from broad to narrow:
 *
 * - `EXPERIENCES_TAG` / `WINERIES_TAG` — LISTING tags. Every public read
 *   carries one of them, and so does every public ISR page. Fire them when
 *   a mutation changes what the listings show or which entities exist
 *   (publish / unpublish / archive / create / delete, title, price, cover,
 *   capacity, winery visibility). Purges the whole public tree.
 * - `EXPERIENCE_AVAILABILITY_TAG` — carried ONLY by the catalogue search
 *   cache (cards with "next availability", date filter, default sort). Fire
 *   it with the entity tag when a mutation moves WHEN an experience can be
 *   booked (weekly slots, occurrences, blocked dates) but not what it is:
 *   the home and the catalogue refresh, the other fiches and the winery
 *   pages stay cached.
 * - `experienceTag(slug)` / `wineryTag(slug)` — ENTITY tags carried by the
 *   single-entity reads (fiche by slug, winery by slug). Fire them alone
 *   for a change only that entity's own page displays.
 *
 * Pure module (no next/cache import) so queries, actions and tests share
 * the exact same strings.
 */
export const EXPERIENCES_TAG = 'experiences';
export const WINERIES_TAG = 'wineries';
export const EXPERIENCE_AVAILABILITY_TAG = 'experiences:availability';

/** Entity tag of one experience fiche (`/experiences/[slug]`). */
export function experienceTag(slug: string): string {
  return `experience:${slug}`;
}

/** Entity tag of one winery fiche (`/wineries/[slug]`). */
export function wineryTag(slug: string): string {
  return `winery:${slug}`;
}

/**
 * Entity tag of the public participants grid of one collective event
 * (keyed by experience id — that read does not know the slug).
 */
export function eventParticipantsTag(experienceId: string): string {
  return `experience-participants:${experienceId}`;
}
