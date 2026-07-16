import { Page, expect } from '@playwright/test';
import type { TestUser } from '../fixtures/auth.fixture';

/**
 * Shared journey helpers for the P-16 launch specs. FR routes throughout
 * (primary product locale); structural selectors (#ids, input types) so
 * the helpers are label-independent.
 */

/** Dismiss the cookie consent overlay when it covers the UI. */
export async function acceptCookiesIfVisible(page: Page) {
  const accept = page.getByRole('button', { name: 'Tout accepter' });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

/** Locale-independent login (the fixture's loginUser matches EN labels). */
export async function loginAsFr(page: Page, user: TestUser) {
  await page.goto('/fr/login');
  await acceptCookiesIfVisible(page);
  await page.locator('input[type="email"]').first().fill(user.email);
  await page.locator('input[type="password"]').first().fill(user.password);
  await page.locator('form button[type="submit"]').first().click();
  // Anywhere but the login page = logged in (loose regexes match /fr/login).
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 15000,
  });
}

/**
 * The E2E fake-session convention redirects to checkout.stripe.com/pay/e2e_*
 * — stub the whole host so specs never leave the app (nor hit the network).
 */
export async function stubStripeCheckout(page: Page) {
  await page.route('https://checkout.stripe.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><h1 data-e2e="stripe-stub">Stripe E2E stub</h1></body></html>',
    })
  );
}

export async function expectOnStripeStub(page: Page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 });
}

/**
 * Fiche expérience → widget (first available date, first time slot, guest
 * count) → checkout page. Returns once the checkout form is visible.
 */
export async function startBooking(
  page: Page,
  input: { slug: string; guests: number }
) {
  await page.goto(`/fr/experiences/${input.slug}`);
  const widget = page.getByTestId('booking-widget');
  await expect(widget).toBeVisible();

  // Date strip: role=application « Calendrier », day buttons (« jeu 16 »).
  await page
    .getByRole('application', { name: 'Calendrier' })
    .locator('button:not([disabled])')
    .first()
    .click();

  // Time slots load async once a date is picked (loading → grid).
  const slotGrid = page.getByTestId('time-slot-grid');
  await expect(slotGrid).toBeVisible({ timeout: 15000 });
  await slotGrid.getByRole('button').first().click();

  const display = page.getByTestId('guest-count-display');
  const increase = page.getByLabel("Augmenter le nombre d'invités");
  for (let i = 0; i < 12; i++) {
    const current = Number((await display.innerText()).replace(/\D/g, ''));
    if (current >= input.guests) break;
    await increase.click();
  }

  await page.getByTestId('continue-to-checkout').click();
  await expect(page.getByTestId('checkout-form')).toBeVisible({
    timeout: 15000,
  });
}

/** Fill the checkout contact form + mandatory checkboxes (18+, CGV). */
export async function fillCheckoutContact(
  page: Page,
  input: { firstName: string; lastName: string; email: string; phone: string }
) {
  await page.locator('#firstName').fill(input.firstName);
  await page.locator('#lastName').fill(input.lastName);
  await page.locator('#email').fill(input.email);
  await page.locator('#phone').fill(input.phone);
  await page.locator('#ageConfirmed').click();
  await page.locator('#acceptedTerms').click();
}

export async function submitCheckout(page: Page) {
  await page.getByRole('button', { name: /Confirmer et payer/ }).click();
}
