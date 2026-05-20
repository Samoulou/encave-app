import { expect, test } from '@playwright/test';

test.describe('Mobile UX redesign', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

  test('home search and category shortcuts use real discovery filters', async ({
    page,
  }) => {
    await page.goto('/fr');

    await expect(page.locator('body')).not.toContainText('Voir les dates');
    await expect(page.getByTestId('mobile-home-capacity')).toContainText(
      '2+ places'
    );
    const capacityLink = page
      .locator('a[href="/fr/experiences?capacity=2"]:visible')
      .first();
    await expect(capacityLink).toBeVisible();
    await expect(
      page.locator('a[href="/fr/experiences?type=TASTING"]:visible').first()
    ).toBeVisible();
    await expect(
      page
        .locator('a[href="/fr/experiences?type=CELLAR_VISIT"]:visible')
        .first()
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

    await expect(
      page.locator('a[href="/fr/experiences"]:visible').last()
    ).toBeVisible();
    await expect(
      page.locator(
        'a[href="/fr/login?callbackUrl=%2Fdashboard%2Fprofile"]:visible, a[href="/fr/login?callbackUrl=/dashboard/profile"]:visible'
      )
    ).toBeVisible();
    await expect(
      page.locator('a[href="/fr/dashboard/my-bookings"]:visible')
    ).toBeVisible();
    await expect(
      page.locator('a[href="/fr/dashboard/profile"]:visible')
    ).toBeVisible();
  });
});
