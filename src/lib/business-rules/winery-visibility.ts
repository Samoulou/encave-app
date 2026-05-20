/**
 * Winery public visibility business rules (ENC-027).
 *
 * A winery is "publicly visible" when ALL the following criteria are met:
 *  1. status === 'VERIFIED'
 *  2. stripeOnboardingComplete === true (proxy KYC, mirrors Stripe Connect
 *     `account.charges_enabled` via the connect webhook).
 *  3. At least one gallery image (cover photo or gallery item).
 *  4. description non-empty after stripping HTML tags and trimming whitespace.
 *  5. latitude AND longitude not null (address geocoded by Nominatim).
 *  6. At least one experience with status === 'PUBLISHED'.
 *
 * Important: this function is a PURE derived check. There is no
 * `Winery.isPubliclyVisible` column in the DB by design — to avoid
 * desynchronisation and recalculation jobs. Every public listing /
 * detail page recomputes on the fly using either:
 *   - the `publiclyVisibleWineryWhere` Prisma where input below
 *     (SQL filter, performant), and/or
 *   - a TS post-filter via `isWineryPubliclyVisible(...)` (catches
 *     edge cases that cannot be expressed in SQL — whitespace-only
 *     or HTML-empty description).
 *
 * NOTE on KYC mapping: the product spec talks about
 * `winery.stripeAccount.charges_enabled`. There is no `StripeAccount`
 * relation in the schema — the Connect webhook persists
 * `account.charges_enabled` into `Winery.stripeOnboardingComplete`.
 * ENC-032b will introduce an explicit `kycStatus` column and the only
 * change required here will be replacing the boolean read in
 * `getWineryVisibilityCriteria.kyc`.
 *
 * DO NOT call Stripe (or any network) from this module. Keep it pure.
 */

import type { Prisma, WineryStatus, ExperienceStatus } from '@prisma/client';

/**
 * Minimum shape a winery must expose to be evaluated.
 * Any query that needs `isWineryPubliclyVisible` MUST select exactly
 * (or a superset of) these fields.
 */
export type WineryVisibilityInput = {
  status: WineryStatus;
  stripeOnboardingComplete: boolean;
  description: string;
  latitude: number | null;
  longitude: number | null;
  galleryImages: ReadonlyArray<{ id: string }>;
  experiences: ReadonlyArray<{ status: ExperienceStatus }>;
};

/**
 * Criterion-by-criterion breakdown.
 * Used by the dashboard banner to know exactly what's missing.
 */
export type WineryVisibilityCriteria = {
  verified: boolean;
  kyc: boolean;
  hasPhotos: boolean;
  hasDescription: boolean;
  hasGeocoding: boolean;
  hasPublishedExperience: boolean;
};

/**
 * Check if a description has any meaningful content after stripping
 * HTML tags and trimming whitespace.
 *
 * Examples:
 *   ''                  → false
 *   '   '               → false
 *   '<p></p>'           → false
 *   '<p>  </p>'         → false
 *   '<p>Hello</p>'      → true
 *   'Plain text'        → true
 */
function hasMeaningfulDescription(description: string): boolean {
  return description.replace(/<[^>]*>/g, '').trim().length >= 1;
}

/**
 * Return the granular criteria breakdown for a winery.
 * Pure function — no I/O.
 */
export function getWineryVisibilityCriteria(
  winery: WineryVisibilityInput
): WineryVisibilityCriteria {
  return {
    verified: winery.status === 'VERIFIED',
    kyc: winery.stripeOnboardingComplete === true,
    hasPhotos: winery.galleryImages.length >= 1,
    hasDescription: hasMeaningfulDescription(winery.description),
    hasGeocoding: winery.latitude !== null && winery.longitude !== null,
    hasPublishedExperience: winery.experiences.some(
      (e) => e.status === 'PUBLISHED'
    ),
  };
}

/**
 * Return `true` only when ALL visibility criteria are satisfied.
 * Composes `getWineryVisibilityCriteria` and folds via `every`.
 */
export function isWineryPubliclyVisible(
  winery: WineryVisibilityInput
): boolean {
  const criteria = getWineryVisibilityCriteria(winery);
  return Object.values(criteria).every((v) => v === true);
}

/**
 * Reusable Prisma where input that filters wineries to the publicly
 * visible ones at the SQL level.
 *
 * Caveat: the SQL `description: { not: '' }` only excludes strictly-empty
 * strings. Whitespace-only or HTML-empty descriptions still pass SQL but
 * MUST be filtered out in TS via `isWineryPubliclyVisible` when the query
 * returns the entity (listing / detail). For queries that only project
 * `slug` / `commune` / aggregates, the SQL filter alone is enough — the
 * delta (a handful of malformed descriptions out of MVP volumes) is
 * acceptable.
 */
export const publiclyVisibleWineryWhere = {
  status: 'VERIFIED',
  stripeOnboardingComplete: true,
  description: { not: '' },
  latitude: { not: null },
  longitude: { not: null },
  experiences: {
    some: { status: 'PUBLISHED' },
  },
} satisfies Prisma.WineryWhereInput;
