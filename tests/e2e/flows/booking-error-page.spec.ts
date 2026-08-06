import { test, expect } from '@playwright/test';

/**
 * P-04 / L-052 — /reservation/erreur (DoD: covers payment refused AND
 * hold expired, with retry / memorized re-selection).
 * The page is pure query-param logic — no DB fixture needed.
 */

const SELECTION = 'slug=domaine-test&date=2026-11-25&time=10%3A00&guests=2';
const FUTURE_ISO = new Date(Date.now() + 20 * 60 * 1000).toISOString();
const PAST_ISO = new Date(Date.now() - 60 * 1000).toISOString();
const HOLD =
  'holdId=ckvhold00000000000000000w&holdToken=e2e-token-0123456789abcdef';

test.describe('booking error page (/reservation/erreur)', () => {
  test('hold-expired: explains the release and offers memorized re-selection', async ({
    page,
  }) => {
    await page.goto(`/fr/reservation/erreur?cause=hold-expired&${SELECTION}`);

    await expect(page.getByTestId('selection-recap')).toBeVisible();
    const reselect = page.getByTestId('reselect-cta');
    await expect(reselect).toBeVisible();
    await expect(reselect).toHaveAttribute(
      'href',
      /\/experiences\/domaine-test\?.*date=2026-11-25/
    );
    await expect(page.getByTestId('retry-payment-cta')).toHaveCount(0);
  });

  test('payment + live hold: primary retry CTA carries the full hold trio', async ({
    page,
  }) => {
    await page.goto(
      `/fr/reservation/erreur?cause=payment&${SELECTION}&${HOLD}&holdExpiresAt=${encodeURIComponent(FUTURE_ISO)}`
    );

    const retry = page.getByTestId('retry-payment-cta');
    await expect(retry).toBeVisible();
    const href = await retry.getAttribute('href');
    expect(href).toContain('/experiences/domaine-test/checkout');
    expect(href).toContain('holdId=ckvhold00000000000000000w');
    expect(href).toContain('holdToken=');
    expect(href).toContain('holdExpiresAt=');
    await expect(page.getByTestId('reselect-cta')).toBeVisible();
  });

  test('payment + dead hold: no retry, re-selection only', async ({ page }) => {
    await page.goto(
      `/fr/reservation/erreur?cause=payment&${SELECTION}&${HOLD}&holdExpiresAt=${encodeURIComponent(PAST_ISO)}`
    );

    await expect(page.getByTestId('retry-payment-cta')).toHaveCount(0);
    await expect(page.getByTestId('reselect-cta')).toBeVisible();
  });

  test('invalid params degrade to the generic fallback, never a crash', async ({
    page,
  }) => {
    // Unparseable date used to throw RangeError in the server render.
    const response = await page.goto(
      '/fr/reservation/erreur?cause=payment&slug=x&date=notadate&time=10%3A00&guests=2'
    );

    expect(response?.status()).toBe(200);
    await expect(page.getByTestId('reselect-cta')).toHaveCount(0);
    await expect(page.getByTestId('selection-recap')).toHaveCount(0);
    // Generic fallback CTA to the experiences catalogue.
    await expect(page.locator('a[href*="/experiences"]').first()).toBeVisible();
  });
});
