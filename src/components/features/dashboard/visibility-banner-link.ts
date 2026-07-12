import type { WineryVisibilityCriteria } from '@/lib/business-rules/winery-visibility';

/**
 * Pick the deep-link URL for the dashboard visibility banner CTA
 * (ENC-027) based on the first criterion that is not yet satisfied,
 * in the UX priority order defined in `docs/archive/specs-v2/ENC-027-ux-ui.md` §4.
 *
 * Falls back to the profile page when every criterion is satisfied
 * (the banner should never render in that case, but we stay defensive).
 *
 * Pure function — kept in its own module so it can be unit tested
 * without dragging the Server Component dependencies (DB, auth, ...)
 * into the test environment.
 */
export function getFirstMissingDeepLink(
  criteria: WineryVisibilityCriteria
): string {
  if (!criteria.verified) return '/dashboard/winery/profile';
  if (!criteria.kyc) return '/dashboard/winery/profile#payment';
  if (!criteria.hasGeocoding) return '/dashboard/winery/profile#location';
  if (!criteria.hasDescription) return '/dashboard/winery/profile#description';
  if (!criteria.hasPhotos) return '/dashboard/winery/profile#media';
  if (!criteria.hasPublishedExperience) return '/dashboard/experiences/new';
  return '/dashboard/winery/profile';
}
