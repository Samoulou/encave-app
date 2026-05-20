import { expect, test } from '@playwright/test';

test.describe('Desktop UX redesign', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('home search and categories use real supported discovery filters', async ({
    page,
  }) => {
    await page.goto('/fr');

    await expect(page.locator('body')).not.toContainText('Ce week-end');
    await expect(page.locator('body')).not.toContainText('Voir les dates');
    const capacityLink = page
      .locator('a[href="/fr/experiences?capacity=2"]:visible')
      .first();
    await expect(capacityLink).toBeVisible();
    await expect(capacityLink).toContainText('2+ places');
    await expect(
      page.locator('a[href="/fr/experiences?type=TASTING"]:visible').first()
    ).toBeVisible();
    await expect(
      page
        .locator('a[href="/fr/experiences?type=CELLAR_VISIT"]:visible')
        .first()
    ).toBeVisible();
  });

  test('discovery only exposes distance sorting when a location is present', async ({
    page,
  }) => {
    await page.goto('/fr/experiences');
    await expect(page.locator('body')).not.toContainText('Plus proche');

    await page.goto(
      '/fr/experiences?location=sion&lat=46.2333&lng=7.3667&sort=distance'
    );
    await expect(page.getByText('Plus proche')).toBeVisible();
  });

  test('detail page uses factual content instead of mocked badges', async ({
    page,
  }) => {
    await page.goto('/fr/experiences/wine-tasting-test');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Premium Wine Tasting'
    );
    await expect(page.getByText('Partager')).toBeVisible();
    await expect(page.getByText('Enregistrer')).toBeVisible();
    await expect(page.getByText('Infos pratiques')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Nouveau sur EnCave');
    await expect(page.locator('body')).not.toContainText('4.9');
    await expect(page.locator('body')).not.toContainText('Langues');
  });
});
