/**
 * P-16 / L-183 — axe (WCAG 2.1 AA) on the booking journey. Zero blocking
 * violation is a launch gate; runs in the e2e CI job on every PR.
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../fixtures/auth.fixture';
import { startBooking, acceptCookiesIfVisible } from '../utils/journeys';

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

test.describe('a11y — booking journey (WCAG 2.1 AA)', () => {
  test('fiche expérience', async ({ page }) => {
    await page.goto('/fr/experiences/auth-winery-tasting');
    await acceptCookiesIfVisible(page);
    await expectNoViolations(page);
  });

  test('checkout (formulaire + récap)', async ({ page }) => {
    await acceptCookiesIfVisible(page);
    await startBooking(page, { slug: 'auth-winery-tasting', guests: 2 });
    await expectNoViolations(page);
  });

  test('billet / détail réservation (token)', async ({ page }) => {
    await page.goto(
      '/fr/booking/test-booking-cancel-target?token=token-cancel-target'
    );
    await acceptCookiesIfVisible(page);
    await expect(
      page.getByRole('heading', { name: 'Détails de la réservation' })
    ).toBeVisible();
    await expectNoViolations(page);
  });
});
