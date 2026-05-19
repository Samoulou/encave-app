import { test, expect } from '@playwright/test';

test.describe('P0 Compliance', () => {
  test('cookie consent can be accepted and persists', async ({ page }) => {
    await page.goto('/en');

    const banner = page.getByRole('heading', {
      name: 'Cookie preferences',
    });
    await expect(banner).toBeVisible();

    await page.getByRole('button', { name: 'Accept all' }).click();
    await expect(banner).toBeHidden();

    const cookie = await page.context().cookies();
    const consentCookie = cookie.find((item) => item.name === 'encave_consent');

    expect(consentCookie).toBeDefined();
    expect(decodeURIComponent(consentCookie?.value ?? '')).toContain(
      '"analytics":true'
    );

    await page.reload();
    await expect(banner).toBeHidden();
  });
});
