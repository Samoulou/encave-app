/**
 * P-16 / L-183 — axe (WCAG 2.1 AA) on the gift-card surfaces. Zero
 * blocking violation is a launch gate; runs in the e2e CI job.
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../fixtures/auth.fixture';
import { acceptCookiesIfVisible } from '../utils/journeys';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }))
  ).toEqual([]);
}

test.describe('a11y — gift cards (WCAG 2.1 AA)', () => {
  test('configurateur /cadeaux', async ({ page }) => {
    await page.goto('/fr/cadeaux');
    await acceptCookiesIfVisible(page);
    await expect(page.locator('#purchaserEmail')).toBeVisible();
    await expectNoViolations(page);
  });

  test('configurateur — variante expérience précise', async ({ page }) => {
    await page.goto('/fr/cadeaux');
    await acceptCookiesIfVisible(page);
    await page.getByRole('button', { name: 'Une expérience précise' }).click();
    await expectNoViolations(page);
  });
});
