import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
vi.mock('@/server/queries/experience.queries', () => ({
  getAllPublishedExperienceSlugs: vi.fn(async () => ['degustation-rhodan']),
}));
vi.mock('@/server/queries/winery.queries', () => ({
  getPubliclyVisibleWinerySlugs: vi.fn(async () => ['cave-du-rhodan']),
}));
vi.mock('@/server/queries/feature-flags.queries', () => ({
  isFlagEnabled: vi.fn(async () => false),
}));

const robots = (await import('@/app/robots')).default;
const sitemap = (await import('@/app/sitemap')).default;

/** Standard robots.txt semantics: a Disallow is a path PREFIX from the root. */
function isDisallowed(path: string): boolean {
  const rules = robots().rules;
  const rule = Array.isArray(rules) ? rules[0] : rules;
  const disallow = rule?.disallow ?? [];
  return (Array.isArray(disallow) ? disallow : [disallow]).some((prefix) =>
    path.startsWith(prefix)
  );
}

describe('robots.txt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    '/fr/dashboard',
    '/fr/dashboard/bookings',
    '/de/dashboard/payouts',
    '/en/dashboard/my-bookings',
    '/fr/admin',
    '/de/admin/wineries',
    '/en/admin-setup/2fa',
    '/fr/onboarding/winery',
    '/fr/invitation/some-token',
    '/api/health',
    '/coming-soon',
  ])('blocks the private path %s (rules carry the locale prefix)', (path) => {
    expect(isDisallowed(path)).toBe(true);
  });

  it.each([
    '/fr',
    '/fr/experiences',
    '/de/experiences/degustation-rhodan',
    '/en/wineries/cave-du-rhodan',
    '/fr/cadeaux',
    '/fr/legal/terms',
    // noindex by meta — must stay crawlable so the noindex is SEEN.
    '/fr/booking/abc123',
  ])('leaves the public path %s crawlable', (path) => {
    expect(isDisallowed(path)).toBe(false);
  });

  it('points at the sitemap of the canonical host', () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe('sitemap.xml', () => {
  it('lists public content in the 3 locales, never the auth forms', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith('/fr/experiences'))).toBe(true);
    expect(
      urls.some((url) => url.endsWith('/de/experiences/degustation-rhodan'))
    ).toBe(true);
    expect(
      urls.some((url) => url.endsWith('/en/wineries/cave-du-rhodan'))
    ).toBe(true);
    expect(urls.filter((url) => /\/(login|register)$/.test(url))).toEqual([]);
  });

  it('never advertises a URL that robots.txt forbids', async () => {
    const paths = (await sitemap()).map((entry) => new URL(entry.url).pathname);

    expect(paths.filter((path) => isDisallowed(path))).toEqual([]);
  });
});
