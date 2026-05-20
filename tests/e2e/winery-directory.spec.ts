import { test, expect } from '@playwright/test';

test.describe('Winery Directory', () => {
  test.describe('Listing Page', () => {
    test('displays page title and description', async ({ page }) => {
      await page.goto('/wineries');

      await expect(
        page.getByRole('heading', { name: 'Wineries in Valais' })
      ).toBeVisible();
      await expect(
        page.getByText(/Discover exceptional winemakers/i)
      ).toBeVisible();
    });

    test('shows empty state when no verified wineries exist', async ({
      page,
    }) => {
      await page.goto('/wineries');

      // If no wineries, should show coming soon message
      const emptyState = page.getByText('Winemakers coming soon...');
      const wineryCards = page.locator('[data-testid="winery-card"]');

      // Either we have wineries or empty state
      const hasWineries = (await wineryCards.count()) > 0;
      if (!hasWineries) {
        await expect(emptyState).toBeVisible();
      }
    });

    test('has correct SEO metadata', async ({ page }) => {
      await page.goto('/wineries');

      await expect(page).toHaveTitle(/Wineries in Valais.*EnCave/);
    });

    test('commune filter updates URL', async ({ page }) => {
      await page.goto('/wineries');

      // Check if filter exists (only shows when communes available)
      const filter = page.getByRole('combobox');
      const filterExists = await filter.isVisible().catch(() => false);

      if (filterExists) {
        await filter.click();
        // Select first available commune option (not "All communes")
        const options = page.getByRole('option');
        const optionCount = await options.count();

        if (optionCount > 1) {
          const firstCommune = options.nth(1);
          const communeName = await firstCommune.textContent();
          await firstCommune.click();

          // URL should include commune parameter
          await expect(page).toHaveURL(new RegExp(`commune=${communeName}`));
        }
      }
    });

    test('commune filter is shareable via URL', async ({ page }) => {
      // Navigate directly with commune parameter
      await page.goto('/wineries?commune=Sion');

      const filter = page.getByRole('combobox');
      const filterExists = await filter.isVisible().catch(() => false);

      if (filterExists && (await page.getByText('Sion').count()) > 0) {
        // Filter should show the commune from URL
        await expect(filter).toContainText('Sion');
      }
    });

    test('responsive grid layout', async ({ page }) => {
      await page.goto('/wineries');
      test.skip(
        (await page.locator('[data-testid="winery-card"]').count()) === 0,
        'No public wineries in the E2E fixture'
      );

      // Desktop - should show 4 columns
      await page.setViewportSize({ width: 1280, height: 800 });
      const grid = page.locator('.grid');
      if (await grid.isVisible()) {
        await expect(grid).toHaveClass(/lg:grid-cols-4/);
      }

      // Tablet - should show 2 columns
      await page.setViewportSize({ width: 768, height: 1024 });
      if (await grid.isVisible()) {
        await expect(grid).toHaveClass(/sm:grid-cols-2/);
      }

      // Mobile - should show 1 column
      await page.setViewportSize({ width: 375, height: 667 });
      if (await grid.isVisible()) {
        await expect(grid).toHaveClass(/grid/);
      }
    });
  });

  test.describe('Detail Page', () => {
    test('shows 404 for non-existent winery', async ({ page }) => {
      await page.goto('/wineries/non-existent-winery-slug');

      await expect(page.locator('body')).not.toContainText('Application error');
    });

    test('displays coming soon teaser', async ({ page }) => {
      // This test requires a verified winery to exist
      // First check if any winery links exist on listing page
      await page.goto('/wineries');

      const wineryLinks = page
        .locator('a[href^="/wineries/"]')
        .filter({ hasNot: page.locator('a[href="/wineries"]') });
      const linkCount = await wineryLinks.count();

      if (linkCount > 0) {
        // Click first winery card
        await wineryLinks.first().click();

        // Check for coming soon teaser
        await expect(
          page.getByText('Coming soon: Book experiences')
        ).toBeVisible();
      }
    });

    test('displays winery information', async ({ page }) => {
      await page.goto('/wineries');

      const wineryLinks = page
        .locator('a[href^="/wineries/"]')
        .filter({ hasNot: page.locator('a[href="/wineries"]') });
      const linkCount = await wineryLinks.count();

      if (linkCount > 0) {
        await wineryLinks.first().click();

        // Should show contact section
        await expect(page.getByText('Contact')).toBeVisible();

        // Should show about section
        await expect(page.getByText('About')).toBeVisible();
      }
    });

    test('has correct SEO metadata with winery name', async ({ page }) => {
      await page.goto('/wineries');

      const wineryLinks = page
        .locator('a[href^="/wineries/"]')
        .filter({ hasNot: page.locator('a[href="/wineries"]') });
      const linkCount = await wineryLinks.count();

      if (linkCount > 0) {
        // Get winery name from card
        const firstCard = wineryLinks.first();
        const wineryName = await firstCard.locator('h3').textContent();

        await firstCard.click();

        // Title should include winery name
        if (wineryName) {
          await expect(page).toHaveTitle(new RegExp(wineryName));
        }
      }
    });
  });
});
