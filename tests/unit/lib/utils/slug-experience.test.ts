import { describe, it, expect } from 'vitest';
import { generateSlug } from '@/lib/utils/slug';

describe('generateSlug for experiences', () => {
  it('generates slug from title', () => {
    expect(generateSlug('Grand Cru Wine Tasting')).toBe('grand-cru-wine-tasting');
  });

  it('handles special characters', () => {
    expect(generateSlug('Dégustation de Vin')).toBe('degustation-de-vin');
  });

  it('handles multiple spaces', () => {
    expect(generateSlug('Wine   Tasting   Experience')).toBe(
      'wine-tasting-experience'
    );
  });

  it('removes leading and trailing hyphens', () => {
    expect(generateSlug(' Wine Tasting ')).toBe('wine-tasting');
  });

  it('limits slug length to 50 characters', () => {
    const longTitle =
      'This is a very long experience title that should be truncated to fifty characters maximum';
    const slug = generateSlug(longTitle);
    expect(slug.length).toBeLessThanOrEqual(50);
  });

  it('handles German umlauts', () => {
    expect(generateSlug('Weinführung mit Käse')).toBe('weinfuhrung-mit-kase');
  });

  it('handles French accents', () => {
    // Note: œ ligature is removed (not expanded to 'oe') by the slug generator
    expect(generateSlug('Expérience œnologique')).toBe('experience-nologique');
  });

  it('handles standard French accents', () => {
    expect(generateSlug('Côtes du Rhône')).toBe('cotes-du-rhone');
  });
});
