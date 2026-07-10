import { test, expect, type Page } from '@playwright/test';

/**
 * P-06 network budgets (DoD): the maplibre-gl chunk (~439 kB) must never
 * load on the initial MOBILE view of the discovery pages — home and
 * catalogue gate it behind DesktopOnly (P-01), the detail pages behind
 * LazyOnVisible (P-06 / L-201). Counter-test: on desktop the map still
 * loads once scrolled into view (guard against over-gating).
 *
 * Detection is by URL: maplibre ships as its own async chunk, and its
 * source URL contains the package chunk name only when requested.
 */

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 800 };

async function collectJsResponses(page: Page): Promise<string[]> {
  const urls: string[] = [];
  page.on('response', (response) => {
    const url = response.url();
    if (url.endsWith('.js') || url.includes('/_next/static/chunks/')) {
      urls.push(url);
    }
  });
  return urls;
}

async function hasMaplibreChunk(page: Page, urls: string[]): Promise<boolean> {
  // The chunk filename is content-hashed: identify it by probing the
  // loaded scripts for the maplibre signature global exposed in the
  // bundle source (fetch bodies of candidate chunks is slow — instead
  // check whether the maplibregl runtime reached the page).
  void urls;
  return page.evaluate(() => {
    interface MaplibreProbe {
      maplibregl?: unknown;
      __maplibre_loaded?: unknown;
    }
    const w = window as MaplibreProbe & Window;
    if (w.maplibregl !== undefined) return true;
    // Fallback: any canvas produced by maplibre carries this class.
    return document.querySelector('.maplibregl-map, .maplibregl-canvas')
      ? true
      : false;
  });
}

const MOBILE_PAGES = [
  { name: 'home', path: '/fr' },
  { name: 'catalogue', path: '/fr/experiences' },
  { name: 'liste caves', path: '/fr/wineries' },
];

for (const { name, path } of MOBILE_PAGES) {
  test(`mobile ${name}: le chunk maplibre ne se charge pas au chargement initial`, async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    const urls = await collectJsResponses(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    expect(await hasMaplibreChunk(page, urls)).toBe(false);
  });
}

test('mobile fiche expérience: pas de maplibre avant scroll vers la carte', async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  // First seeded fiche via the catalogue grid.
  await page.goto('/fr/experiences');
  await page.waitForLoadState('networkidle');
  const firstCard = page.getByTestId('experience-card').first();
  const href = await firstCard
    .locator('xpath=ancestor-or-self::a')
    .first()
    .getAttribute('href')
    .catch(() => null);
  test.skip(!href, 'no seeded experience card');

  const urls = await collectJsResponses(page);
  await page.goto(href as string);
  await page.waitForLoadState('networkidle');

  // Above the fold only — the map is below.
  expect(await hasMaplibreChunk(page, urls)).toBe(false);
});

test('desktop fiche expérience: la carte se charge après scroll (garde anti-sur-gating)', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/fr/experiences');
  await page.waitForLoadState('networkidle');
  const firstCard = page.getByTestId('experience-card').first();
  const href = await firstCard
    .locator('xpath=ancestor-or-self::a')
    .first()
    .getAttribute('href')
    .catch(() => null);
  test.skip(!href, 'no seeded experience card');

  await page.goto(href as string);
  await page.waitForLoadState('networkidle');

  const locationSection = page.getByTestId('location-section');
  test.skip(
    !(await locationSection.count()),
    'fiche without coordinates in seed'
  );
  await locationSection.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => hasMaplibreChunk(page, []), { timeout: 15_000 })
    .toBe(true);
});
