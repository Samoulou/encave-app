import { Page } from '@playwright/test';

/**
 * Stripe test card numbers
 * @see https://stripe.com/docs/testing#cards
 */
export const STRIPE_TEST_CARDS = {
  /** Successful payment */
  SUCCESS: '4242424242424242',
  /** Card declined */
  DECLINED: '4000000000000002',
  /** Insufficient funds */
  INSUFFICIENT_FUNDS: '4000000000009995',
  /** Requires authentication (3D Secure) */
  REQUIRES_AUTH: '4000002500003155',
  /** Processing error */
  PROCESSING_ERROR: '4000000000000119',
  /** Expired card */
  EXPIRED: '4000000000000069',
  /** Incorrect CVC */
  INCORRECT_CVC: '4000000000000127',
} as const;

export type StripeTestCard = keyof typeof STRIPE_TEST_CARDS;

/**
 * Default test card details
 */
export const DEFAULT_CARD_DETAILS = {
  expiry: '12/30',
  cvc: '123',
  name: 'Test User',
  postalCode: '1000',
};

/**
 * Complete a Stripe Checkout session with a test card
 *
 * @param page - Playwright page object (should be on Stripe Checkout)
 * @param card - Which test card to use (default: SUCCESS)
 * @param options - Additional card details to override
 */
export async function completeStripeCheckout(
  page: Page,
  card: StripeTestCard = 'SUCCESS',
  options?: Partial<typeof DEFAULT_CARD_DETAILS>
): Promise<void> {
  // Ensure we're on Stripe Checkout
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });

  const cardNumber = STRIPE_TEST_CARDS[card];
  const details = { ...DEFAULT_CARD_DETAILS, ...options };

  // Stripe Checkout uses iframes, so we need to handle that
  // The exact selectors may vary based on Stripe's implementation

  // Wait for the payment form to load
  await page.waitForLoadState('networkidle');

  // Fill card number
  const cardNumberInput = page.locator(
    '[data-testid="card-number-input"], #cardNumber, [name="cardNumber"]'
  );
  if (await cardNumberInput.isVisible()) {
    await cardNumberInput.fill(cardNumber);
  } else {
    // Try iframe approach
    const cardFrame = page.frameLocator('iframe[name*="card"]').first();
    await cardFrame
      .locator(
        '[name="cardnumber"], [data-elements-stable-field-name="cardNumber"]'
      )
      .fill(cardNumber);
  }

  // Fill expiry
  const expiryInput = page.locator(
    '[data-testid="expiry-input"], #cardExpiry, [name="cardExpiry"]'
  );
  if (await expiryInput.isVisible()) {
    await expiryInput.fill(details.expiry);
  } else {
    const expiryFrame = page.frameLocator('iframe[name*="expiry"]').first();
    await expiryFrame
      .locator(
        '[name="exp-date"], [data-elements-stable-field-name="cardExpiry"]'
      )
      .fill(details.expiry);
  }

  // Fill CVC
  const cvcInput = page.locator(
    '[data-testid="cvc-input"], #cardCvc, [name="cardCvc"]'
  );
  if (await cvcInput.isVisible()) {
    await cvcInput.fill(details.cvc);
  } else {
    const cvcFrame = page.frameLocator('iframe[name*="cvc"]').first();
    await cvcFrame
      .locator('[name="cvc"], [data-elements-stable-field-name="cardCvc"]')
      .fill(details.cvc);
  }

  // Fill name on card if present
  const nameInput = page.locator(
    '[data-testid="name-input"], #billingName, [name="billingName"]'
  );
  if (await nameInput.isVisible()) {
    await nameInput.fill(details.name);
  }

  // Fill postal code if present
  const postalInput = page.locator(
    '[data-testid="postal-input"], #billingPostalCode, [name="billingPostalCode"]'
  );
  if (await postalInput.isVisible()) {
    await postalInput.fill(details.postalCode);
  }

  // Submit payment
  const submitButton = page
    .locator('[data-testid="submit-button"], button[type="submit"]')
    .filter({ hasText: /pay/i });
  await submitButton.click();

  // Wait for redirect back to app (confirmation page)
  await page.waitForURL(/\/booking\/.*\/confirmation/, { timeout: 60000 });
}

/**
 * Cancel/abandon a Stripe Checkout session
 *
 * @param page - Playwright page object (should be on Stripe Checkout)
 */
export async function cancelStripeCheckout(page: Page): Promise<void> {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });

  // Look for back/cancel link
  const backLink = page.locator(
    'a[data-testid="back-link"], a:has-text("Back"), button:has-text("Cancel")'
  );
  await backLink.click();

  // Wait for redirect back to checkout page
  await page.waitForURL(/\/checkout/, { timeout: 30000 });
}

/**
 * Handle 3D Secure authentication in test mode
 *
 * @param page - Playwright page object
 * @param action - Whether to complete or fail the authentication
 */
export async function handle3DSecure(
  page: Page,
  action: 'complete' | 'fail' = 'complete'
): Promise<void> {
  // Wait for 3DS iframe/modal to appear
  const frame = page.frameLocator('iframe[name*="stripe-challenge"]').first();

  if (action === 'complete') {
    // Click "Complete authentication" button in test mode
    await frame
      .locator('button:has-text("Complete"), #test-source-authorize-3ds')
      .click();
  } else {
    // Click "Fail authentication" button in test mode
    await frame
      .locator('button:has-text("Fail"), #test-source-fail-3ds')
      .click();
  }
}

/**
 * Wait for Stripe webhook to process (in test environment)
 * This adds a small delay to allow webhook processing
 *
 * @param ms - Milliseconds to wait (default: 2000)
 */
export async function waitForStripeWebhook(
  page: Page,
  ms: number = 2000
): Promise<void> {
  await page.waitForTimeout(ms);
}

/**
 * Check if currently on Stripe Checkout
 */
export function isOnStripeCheckout(page: Page): boolean {
  return page.url().includes('checkout.stripe.com');
}

/**
 * Get the Stripe session ID from URL if present
 */
export function getStripeSessionId(page: Page): string | null {
  const url = new URL(page.url());
  return url.searchParams.get('session_id') || null;
}
