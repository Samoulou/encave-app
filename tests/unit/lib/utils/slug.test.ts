import { describe, it, expect } from 'vitest';
import { generateSlug } from '@/lib/utils/slug';

describe('generateSlug', () => {
  it('converts name to lowercase', () => {
    expect(generateSlug('Domaine Des Vignes')).toBe('domaine-des-vignes');
  });

  it('replaces spaces with hyphens', () => {
    expect(generateSlug('My Winery Name')).toBe('my-winery-name');
  });

  it('removes special characters', () => {
    expect(generateSlug("Winery's & Co.")).toBe('winery-s-co');
  });

  it('handles French diacritics', () => {
    expect(generateSlug('Château Côte-Rôtie')).toBe('chateau-cote-rotie');
  });

  it('handles German umlauts', () => {
    expect(generateSlug('Müller Weingut')).toBe('muller-weingut');
  });

  it('removes leading and trailing hyphens', () => {
    expect(generateSlug('---Test Winery---')).toBe('test-winery');
  });

  it('collapses multiple hyphens into one', () => {
    expect(generateSlug('Test   Multiple   Spaces')).toBe(
      'test-multiple-spaces'
    );
  });

  it('limits length to 50 characters', () => {
    const longName =
      'This Is A Very Long Winery Name That Should Be Truncated To Fifty Characters';
    const slug = generateSlug(longName);
    expect(slug.length).toBeLessThanOrEqual(50);
  });

  it('handles numbers in name', () => {
    expect(generateSlug('Winery 2024')).toBe('winery-2024');
  });

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('');
  });

  it('creates URL-safe slugs', () => {
    const slug = generateSlug('Domaine de la Côte');
    // URL-safe means only lowercase letters, numbers, and hyphens
    expect(slug).toMatch(/^[a-z0-9-]*$/);
  });
});
