import { expect, test } from '@playwright/test';

test.describe('Desktop UX redesign', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('home search and categories use real supported discovery filters', async ({
    page,
  }) => {
    await page.goto('/fr');

    // P-01-era fake CTA must stay gone…
    await expect(page.locator('body')).not.toContainText('Voir les dates');
    // …but « Ce week-end » is now a REAL date filter (P-05 / L-111): the
    // chip carries the computed weekend range (client-mounted href).
    const weekendChip = page
      .locator('a[href*="quand="]:visible', { hasText: 'Ce week-end' })
      .first();
    await expect(weekendChip).toBeVisible();
    await expect(
      page.locator('a[href*="type=TASTING"]:visible').first()
    ).toBeVisible();
    await expect(
      page.locator('a[href*="type=CELLAR_VISIT"]:visible').first()
    ).toBeVisible();
  });

  test('discovery only exposes distance sorting when a location is present', async ({
    page,
  }) => {
    await page.goto('/fr/experiences');
    // Sort pill labels moved to search.sort — « Distance » only with a geo
    // context (visibleSortOptions gate).
    await expect(
      page.getByRole('button', { name: 'Distance', exact: true })
    ).toBeHidden();

    await page.goto(
      '/fr/experiences?location=sion&lat=46.2333&lng=7.3667&sort=distance'
    );
    await expect(
      page.getByRole('button', { name: 'Distance', exact: true })
    ).toBeVisible();
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
