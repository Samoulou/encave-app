import { test, expect } from '@playwright/test';
import { CheckoutPage } from '../pages';
import { TEST_EXPERIENCES, TEST_VISITORS } from '../fixtures/test-data';

const testExperience = TEST_EXPERIENCES.wineTasting;
const bookingDate = '2026-06-05';
const bookingTime = '10:00';
const guestCount = 2;

test.describe('Guest booking smoke flow', () => {
  test('public experience listing exposes bookable experiences', async ({
    page,
  }) => {
    await page.goto('/en/experiences');

    await expect(page.getByTestId('search-results-grid')).toBeVisible();
    await expect(page.getByTestId('experience-card').first()).toBeVisible();
  });

  test('experience detail renders booking widget and 18+ notice', async ({
    page,
  }) => {
    await page.goto(`/en/experiences/${testExperience.slug}`);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('booking-widget')).toBeVisible();
    await expect(page.getByText('18+')).toBeVisible();
  });

  test('checkout blocks payment until age is confirmed', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.navigate(testExperience.slug, {
      date: bookingDate,
      time: bookingTime,
      guests: guestCount,
    });

    await checkoutPage.fillForm(TEST_VISITORS.validVisitor);
    await checkoutPage.clickPay();

    expect(await checkoutPage.hasAgeConfirmationError()).toBe(true);
    await expect(page).not.toHaveURL(/checkout\.stripe\.com/);
  });

  test('checkout shows validation errors for missing visitor fields', async ({
    page,
  }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.navigate(testExperience.slug, {
      date: bookingDate,
      time: bookingTime,
      guests: guestCount,
    });

    await checkoutPage.clickPay();

    expect(await checkoutPage.hasValidationErrors()).toBe(true);
  });
});
