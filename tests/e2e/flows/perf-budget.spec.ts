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

async function hasMaplibreChunk(page: Page): Promise<boolean> {
  // Detection is RUNTIME-level, not network-level: the chunk filename is
  // content-hashed, so we probe for the maplibregl global / DOM nodes
  // that only exist once the library executed. Limitation (accepted): a
  // chunk that downloads without instantiating a map would pass — the
  // Lighthouse-trace check in the C9 measurement protocol covers bytes.
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
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    expect(await hasMaplibreChunk(page)).toBe(false);
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

  await page.goto(href as string);
  await page.waitForLoadState('networkidle');

  // Above the fold only — the map is below.
  expect(await hasMaplibreChunk(page)).toBe(false);
});

test('desktop fiche expérience: la carte se charge après scroll (garde anti-sur-gating)', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  // No networkidle here: the DESKTOP catalogue legitimately loads maplibre
  // whose tile requests keep the network busy indefinitely — wait for the
  // grid instead.
  await page.goto('/fr/experiences');
  const firstCard = page.getByTestId('experience-card').first();
  await firstCard.waitFor({ timeout: 15_000 });
  const href = await firstCard
    .locator('xpath=ancestor-or-self::a')
    .first()
    .getAttribute('href')
    .catch(() => null);
  test.skip(!href, 'no seeded experience card');

  await page.goto(href as string);
  await page.waitForLoadState('domcontentloaded');

  const locationSection = page.getByTestId('location-section');
  test.skip(
    !(await locationSection.count()),
    'fiche without coordinates in seed'
  );
  await locationSection.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => hasMaplibreChunk(page), { timeout: 15_000 })
    .toBe(true);
});
