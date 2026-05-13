import { describe, it, expect } from 'vitest';
import { getFirstMissingDeepLink } from '@/components/features/dashboard/visibility-banner-link';
import type { WineryVisibilityCriteria } from '@/lib/business-rules/winery-visibility';

/**
 * Build a fully validated criteria set and let each test override
 * specific fields to model partial states.
 */
function allDone(
  overrides: Partial<WineryVisibilityCriteria> = {}
): WineryVisibilityCriteria {
  return {
    verified: true,
    kyc: true,
    hasPhotos: true,
    hasDescription: true,
    hasGeocoding: true,
    hasPublishedExperience: true,
    ...overrides,
  };
}

describe('getFirstMissingDeepLink', () => {
  it('returns the profile page when only verified is pending (non-actionable)', () => {
    expect(getFirstMissingDeepLink(allDone({ verified: false }))).toBe(
      '/dashboard/winery/profile'
    );
  });

  it('points at the Stripe section when KYC is the first gap', () => {
    expect(getFirstMissingDeepLink(allDone({ kyc: false }))).toBe(
      '/dashboard/winery/profile#payment'
    );
  });

  it('points at the location section when geocoding is missing', () => {
    expect(getFirstMissingDeepLink(allDone({ hasGeocoding: false }))).toBe(
      '/dashboard/winery/profile#location'
    );
  });

  it('points at the description section when description is missing', () => {
    expect(getFirstMissingDeepLink(allDone({ hasDescription: false }))).toBe(
      '/dashboard/winery/profile#description'
    );
  });

  it('points at the media section when photos are missing', () => {
    expect(getFirstMissingDeepLink(allDone({ hasPhotos: false }))).toBe(
      '/dashboard/winery/profile#media'
    );
  });

  it('points at experience creation when no experience is PUBLISHED', () => {
    expect(
      getFirstMissingDeepLink(allDone({ hasPublishedExperience: false }))
    ).toBe('/dashboard/experiences/new');
  });

  it('honours the priority order — verified outranks every other gap', () => {
    expect(
      getFirstMissingDeepLink(
        allDone({
          verified: false,
          kyc: false,
          hasPhotos: false,
        })
      )
    ).toBe('/dashboard/winery/profile');
  });

  it('honours the priority order — kyc outranks geocoding / photos / experience', () => {
    expect(
      getFirstMissingDeepLink(
        allDone({
          kyc: false,
          hasGeocoding: false,
          hasPhotos: false,
        })
      )
    ).toBe('/dashboard/winery/profile#payment');
  });

  it('falls back to the profile page when everything is already done', () => {
    expect(getFirstMissingDeepLink(allDone())).toBe(
      '/dashboard/winery/profile'
    );
  });
});
