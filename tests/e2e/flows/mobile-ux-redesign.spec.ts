import { expect, test } from '@playwright/test';

test.describe('Mobile UX redesign', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

  test('home search and category shortcuts use real discovery filters', async ({
    page,
  }) => {
    await page.goto('/fr');

    await expect(page.locator('body')).not.toContainText('Voir les dates');
    await expect(page.getByText('2+ places')).toBeVisible();
    await expect(
      page.locator('a[href="/fr/experiences?capacity=2"]').first()
    ).toBeVisible();
    await expect(
      page.locator('a[href="/fr/experiences?type=TASTING"]').first()
    ).toBeVisible();
    await expect(
      page.locator('a[href="/fr/experiences?type=CELLAR_VISIT"]').first()
    ).toBeVisible();
  });

  test('featured and nearby cards open real experience detail pages', async ({
    page,
  }) => {
    await page.goto('/fr');

    const experienceLinks = page.locator(
      'a[href^="/fr/experiences/"]:not([href*="?"])'
    );
    await expect(experienceLinks.first()).toBeVisible();

    await experienceLinks.first().click();
    await expect(page).toHaveURL(/\/fr\/experiences\/[^/]+$/);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('bottom navigation points to real account routes', async ({ page }) => {
    await page.goto('/fr');

    await expect(page.locator('a[href="/fr/experiences"]').last()).toBeVisible();
    await expect(
      page.locator(
        'a[href="/fr/login?callbackUrl=%2Fdashboard%2Fprofile"], a[href="/fr/login?callbackUrl=/dashboard/profile"]'
      )
    ).toBeVisible();
    await expect(
      page.locator('a[href="/fr/dashboard/my-bookings"]')
    ).toBeVisible();
    await expect(page.locator('a[href="/fr/dashboard/profile"]')).toBeVisible();
  });
});
