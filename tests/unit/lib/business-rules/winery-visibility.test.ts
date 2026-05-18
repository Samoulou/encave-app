import { describe, it, expect } from 'vitest';
import {
  getWineryVisibilityCriteria,
  isWineryPubliclyVisible,
  publiclyVisibleWineryWhere,
  type WineryVisibilityInput,
} from '@/lib/business-rules/winery-visibility';

/**
 * Build a winery input that satisfies all 6 ENC-027 visibility
 * criteria, then let each test override the field it cares about.
 */
function happyWinery(
  overrides: Partial<WineryVisibilityInput> = {}
): WineryVisibilityInput {
  return {
    status: 'VERIFIED',
    stripeOnboardingComplete: true,
    description: 'A small winery in Valais with a long tasting tradition.',
    latitude: 46.2,
    longitude: 7.4,
    galleryImages: [{ id: 'img-1' }],
    experiences: [{ status: 'PUBLISHED' }],
    ...overrides,
  };
}

describe('winery-visibility', () => {
  describe('isWineryPubliclyVisible — happy path', () => {
    it('returns true when every criterion is satisfied', () => {
      expect(isWineryPubliclyVisible(happyWinery())).toBe(true);
    });
  });

  describe('isWineryPubliclyVisible — single criterion failures', () => {
    it.each([
      ['PENDING' as const],
      ['REJECTED' as const],
      ['SUSPENDED' as const],
    ])('returns false when status is %s', (status) => {
      expect(isWineryPubliclyVisible(happyWinery({ status }))).toBe(false);
    });

    it('returns false when KYC (stripeOnboardingComplete) is false', () => {
      expect(
        isWineryPubliclyVisible(
          happyWinery({ stripeOnboardingComplete: false })
        )
      ).toBe(false);
    });

    it('returns false when there are no gallery images', () => {
      expect(isWineryPubliclyVisible(happyWinery({ galleryImages: [] }))).toBe(
        false
      );
    });

    it('returns true with a single gallery image (minimum threshold)', () => {
      expect(
        isWineryPubliclyVisible(
          happyWinery({ galleryImages: [{ id: 'only-one' }] })
        )
      ).toBe(true);
    });

    it('returns false when latitude is null', () => {
      expect(isWineryPubliclyVisible(happyWinery({ latitude: null }))).toBe(
        false
      );
    });

    it('returns false when longitude is null', () => {
      expect(isWineryPubliclyVisible(happyWinery({ longitude: null }))).toBe(
        false
      );
    });

    it('returns false when there are no experiences at all', () => {
      expect(isWineryPubliclyVisible(happyWinery({ experiences: [] }))).toBe(
        false
      );
    });

    it('returns false when no experience is PUBLISHED (only DRAFT/ARCHIVED)', () => {
      expect(
        isWineryPubliclyVisible(
          happyWinery({
            experiences: [{ status: 'DRAFT' }, { status: 'ARCHIVED' }],
          })
        )
      ).toBe(false);
    });

    it('returns true when at least one experience is PUBLISHED (mixed)', () => {
      expect(
        isWineryPubliclyVisible(
          happyWinery({
            experiences: [
              { status: 'DRAFT' },
              { status: 'PUBLISHED' },
              { status: 'ARCHIVED' },
            ],
          })
        )
      ).toBe(true);
    });
  });

  describe('description strip-tags + trim', () => {
    it('returns false for the empty string', () => {
      expect(isWineryPubliclyVisible(happyWinery({ description: '' }))).toBe(
        false
      );
    });

    it('returns false for whitespace-only descriptions', () => {
      expect(isWineryPubliclyVisible(happyWinery({ description: '   ' }))).toBe(
        false
      );
      expect(
        isWineryPubliclyVisible(happyWinery({ description: '\n\t  ' }))
      ).toBe(false);
    });

    it('returns false for HTML-only descriptions with no text content', () => {
      expect(
        isWineryPubliclyVisible(happyWinery({ description: '<p></p>' }))
      ).toBe(false);
      expect(
        isWineryPubliclyVisible(happyWinery({ description: '<p>  </p>' }))
      ).toBe(false);
      expect(
        isWineryPubliclyVisible(
          happyWinery({ description: '<div><span></span></div>' })
        )
      ).toBe(false);
    });

    it('returns true for HTML that contains real text', () => {
      expect(
        isWineryPubliclyVisible(happyWinery({ description: '<p>Hello</p>' }))
      ).toBe(true);
    });

    it('returns true for a single non-whitespace character', () => {
      expect(isWineryPubliclyVisible(happyWinery({ description: 'a' }))).toBe(
        true
      );
    });
  });

  describe('multiple criteria failures', () => {
    it('returns false when several criteria fail simultaneously', () => {
      const w = happyWinery({
        status: 'PENDING',
        stripeOnboardingComplete: false,
      });
      expect(isWineryPubliclyVisible(w)).toBe(false);

      const c = getWineryVisibilityCriteria(w);
      expect(c.verified).toBe(false);
      expect(c.kyc).toBe(false);
      // Other criteria should still report correctly.
      expect(c.hasPhotos).toBe(true);
      expect(c.hasDescription).toBe(true);
      expect(c.hasGeocoding).toBe(true);
      expect(c.hasPublishedExperience).toBe(true);
    });
  });

  describe('getWineryVisibilityCriteria — granular breakdown', () => {
    it('reports every criterion as true on the happy path', () => {
      expect(getWineryVisibilityCriteria(happyWinery())).toEqual({
        verified: true,
        kyc: true,
        hasPhotos: true,
        hasDescription: true,
        hasGeocoding: true,
        hasPublishedExperience: true,
      });
    });

    it('reports every criterion as false on a brand-new PENDING winery', () => {
      const fresh: WineryVisibilityInput = {
        status: 'PENDING',
        stripeOnboardingComplete: false,
        description: '',
        latitude: null,
        longitude: null,
        galleryImages: [],
        experiences: [],
      };

      expect(getWineryVisibilityCriteria(fresh)).toEqual({
        verified: false,
        kyc: false,
        hasPhotos: false,
        hasDescription: false,
        hasGeocoding: false,
        hasPublishedExperience: false,
      });
    });

    it('flips only `verified` when status moves PENDING → VERIFIED', () => {
      const pending = happyWinery({ status: 'PENDING' });
      const verified = happyWinery({ status: 'VERIFIED' });

      expect(getWineryVisibilityCriteria(pending).verified).toBe(false);
      expect(getWineryVisibilityCriteria(verified).verified).toBe(true);
    });

    it('reports only `verified=false` for a SUSPENDED winery that is otherwise fully complete (ENC-027 scénario "cave masquée")', () => {
      const suspended = happyWinery({ status: 'SUSPENDED' });

      expect(isWineryPubliclyVisible(suspended)).toBe(false);
      expect(getWineryVisibilityCriteria(suspended)).toEqual({
        verified: false,
        kyc: true,
        hasPhotos: true,
        hasDescription: true,
        hasGeocoding: true,
        hasPublishedExperience: true,
      });
    });

    it('reports only `kyc=false` when Stripe charges_enabled flips to false on an otherwise visible winery', () => {
      const lostKyc = happyWinery({ stripeOnboardingComplete: false });

      expect(isWineryPubliclyVisible(lostKyc)).toBe(false);
      expect(getWineryVisibilityCriteria(lostKyc)).toMatchObject({
        verified: true,
        kyc: false,
        hasPhotos: true,
        hasDescription: true,
        hasGeocoding: true,
        hasPublishedExperience: true,
      });
    });
  });

  describe('publiclyVisibleWineryWhere', () => {
    it('exposes the six SQL filters expected by public queries', () => {
      // We don't reach into Prisma — we just snapshot the constant shape
      // so that any drift between the where clause and the criteria fails
      // loudly in CI.
      expect(publiclyVisibleWineryWhere).toMatchObject({
        status: 'VERIFIED',
        stripeOnboardingComplete: true,
        description: { not: '' },
        latitude: { not: null },
        longitude: { not: null },
        galleryImages: { some: {} },
        experiences: { some: { status: 'PUBLISHED' } },
      });
    });
  });
});
