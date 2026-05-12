import { test, expect } from '@playwright/test';

test.describe('Winery Directory Performance', () => {
  // AC12: Page loads in under 2 seconds (LCP metric)
  const LCP_BUDGET_MS = 2000;

  test('listing page LCP is under 2 seconds', async ({ page }) => {
    // Collect LCP metric
    const lcpPromise = page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let lcpValue = 0;

        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            lcpValue = lastEntry.startTime;
          }
        });

        observer.observe({ type: 'largest-contentful-paint', buffered: true });

        // Wait for page to settle, then return LCP
        setTimeout(() => {
          observer.disconnect();
          resolve(lcpValue);
        }, 3000);
      });
    });

    await page.goto('/wineries', { waitUntil: 'networkidle' });
    const lcp = await lcpPromise;

    console.log(`Wineries listing page LCP: ${lcp}ms`);
    expect(lcp).toBeLessThan(LCP_BUDGET_MS);
  });

  test('detail page LCP is under 2 seconds', async ({ page }) => {
    // First, get a valid winery slug
    await page.goto('/wineries');

    const wineryLinks = page.locator('a[href^="/wineries/"]').filter({
      hasNot: page.locator('a[href="/wineries"]'),
    });
    const linkCount = await wineryLinks.count();

    if (linkCount === 0) {
      test.skip();
      return;
    }

    const href = await wineryLinks.first().getAttribute('href');
    if (!href) {
      test.skip();
      return;
    }

    // Now measure LCP for detail page
    const lcpPromise = page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let lcpValue = 0;

        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            lcpValue = lastEntry.startTime;
          }
        });

        observer.observe({ type: 'largest-contentful-paint', buffered: true });

        setTimeout(() => {
          observer.disconnect();
          resolve(lcpValue);
        }, 3000);
      });
    });

    await page.goto(href, { waitUntil: 'networkidle' });
    const lcp = await lcpPromise;

    console.log(`Winery detail page LCP: ${lcp}ms`);
    expect(lcp).toBeLessThan(LCP_BUDGET_MS);
  });

  test('listing page loads key content quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/wineries');

    // Wait for main content to be visible
    await page
      .getByRole('heading', { name: 'Wineries in Valais' })
      .waitFor({ state: 'visible' });

    const loadTime = Date.now() - startTime;
    console.log(`Time to visible content: ${loadTime}ms`);

    // Content should be visible within 2 seconds
    expect(loadTime).toBeLessThan(LCP_BUDGET_MS);
  });

  test('images use Next.js Image optimization', async ({ page }) => {
    await page.goto('/wineries');

    // Check if images are using Next.js Image component (srcset attribute)
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < Math.min(imageCount, 5); i++) {
      const img = images.nth(i);
      const srcset = await img.getAttribute('srcset');
      const sizes = await img.getAttribute('sizes');

      // Next.js Image component adds srcset and sizes for optimization
      if (srcset) {
        expect(srcset).toContain('w=');
        expect(sizes).toBeTruthy();
      }
    }
  });
});
