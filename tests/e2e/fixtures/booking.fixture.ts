import { test as base, Page } from '@playwright/test';
import {
  TestBooking,
  TestExperience,
  TestVisitor,
  TEST_EXPERIENCES,
  TEST_VISITORS,
  createTestBooking,
  formatPrice,
} from './test-data';
import { getNextWeekday, formatDisplayDate } from '../utils/date-helpers';
import {
  SearchPage,
  ExperienceDetailPage,
  BookingPage,
  CheckoutPage,
  ConfirmationPage,
} from '../pages';

/**
 * Booking fixtures for E2E tests
 *
 * These fixtures provide pre-configured booking states for tests,
 * reducing boilerplate and ensuring consistent test data.
 */

// ============================================================
// TYPES
// ============================================================

/**
 * Booking selection data
 */
export interface BookingSelection {
  date: string;
  time: string;
  guests: number;
}

/**
 * Complete booking data (selection + visitor)
 */
export interface CompleteBookingData extends BookingSelection {
  visitor: TestVisitor;
  experience: TestExperience;
}

/**
 * Booking test fixtures
 */
export interface BookingFixtures {
  /** Page with all page objects ready */
  guestJourneyPages: {
    searchPage: SearchPage;
    experienceDetailPage: ExperienceDetailPage;
    bookingPage: BookingPage;
    checkoutPage: CheckoutPage;
    confirmationPage: ConfirmationPage;
  };

  /** Pre-configured valid booking selection */
  validBookingSelection: BookingSelection;

  /** Pre-configured complete booking data */
  completeBookingData: CompleteBookingData;

  /** Navigate to booking page with experience pre-selected */
  navigateToBooking: (experienceSlug?: string) => Promise<BookingPage>;

  /** Navigate to checkout with all selections made */
  navigateToCheckout: (data?: Partial<CompleteBookingData>) => Promise<CheckoutPage>;
}

// ============================================================
// DEFAULT VALUES
// ============================================================

/**
 * Get default valid booking selection
 */
function getDefaultBookingSelection(): BookingSelection {
  return {
    date: getNextWeekday(7), // Next weekday at least 7 days out
    time: '10:00',
    guests: 2,
  };
}

/**
 * Get default complete booking data
 */
function getDefaultCompleteBookingData(): CompleteBookingData {
  return {
    ...getDefaultBookingSelection(),
    visitor: TEST_VISITORS.validVisitor,
    experience: TEST_EXPERIENCES.wineTasting,
  };
}

// ============================================================
// FIXTURES
// ============================================================

/**
 * Extended test with booking fixtures
 *
 * Usage:
 * ```typescript
 * import { test, expect } from '../fixtures/booking.fixture';
 *
 * test('guest can complete booking', async ({
 *   guestJourneyPages,
 *   validBookingSelection,
 *   navigateToBooking,
 * }) => {
 *   const bookingPage = await navigateToBooking();
 *   await bookingPage.selectDate(validBookingSelection.date);
 *   // ...
 * });
 * ```
 */
export const test = base.extend<BookingFixtures>({
  /**
   * All guest journey page objects
   */
  guestJourneyPages: async ({ page }, use) => {
    await use({
      searchPage: new SearchPage(page),
      experienceDetailPage: new ExperienceDetailPage(page),
      bookingPage: new BookingPage(page),
      checkoutPage: new CheckoutPage(page),
      confirmationPage: new ConfirmationPage(page),
    });
  },

  /**
   * Pre-configured valid booking selection
   */
  validBookingSelection: async ({}, use) => {
    await use(getDefaultBookingSelection());
  },

  /**
   * Pre-configured complete booking data
   */
  completeBookingData: async ({}, use) => {
    await use(getDefaultCompleteBookingData());
  },

  /**
   * Navigate to booking page helper
   */
  navigateToBooking: async ({ page }, use) => {
    const navigate = async (experienceSlug?: string) => {
      const slug = experienceSlug ?? TEST_EXPERIENCES.wineTasting.slug;
      const bookingPage = new BookingPage(page);
      await bookingPage.navigate(slug);
      return bookingPage;
    };
    await use(navigate);
  },

  /**
   * Navigate to checkout helper
   */
  navigateToCheckout: async ({ page }, use) => {
    const navigate = async (data?: Partial<CompleteBookingData>) => {
      const fullData = { ...getDefaultCompleteBookingData(), ...data };
      const checkoutPage = new CheckoutPage(page);
      await checkoutPage.navigate(fullData.experience.slug, {
        date: fullData.date,
        time: fullData.time,
        guests: fullData.guests,
      });
      return checkoutPage;
    };
    await use(navigate);
  },
});

/**
 * Re-export expect
 */
export { expect } from '@playwright/test';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Complete the full booking flow from search to confirmation
 *
 * This is a high-level helper for tests that need a completed booking
 * but aren't testing the booking flow itself.
 */
export async function completeFullBookingFlow(
  page: Page,
  data?: Partial<CompleteBookingData>
): Promise<{
  confirmationPage: ConfirmationPage;
  bookingReference: string;
}> {
  const fullData = { ...getDefaultCompleteBookingData(), ...data };

  // Navigate to experience and start booking
  const experienceDetailPage = new ExperienceDetailPage(page);
  await experienceDetailPage.navigate(fullData.experience.slug);
  await experienceDetailPage.clickBookNow();

  // Complete booking selections
  const bookingPage = new BookingPage(page);
  await bookingPage.selectDateByString(fullData.date);
  await bookingPage.selectTimeSlot(fullData.time);
  await bookingPage.setGuestCount(fullData.guests);
  await bookingPage.continueToCheckout();

  // Complete checkout
  const checkoutPage = new CheckoutPage(page);
  await checkoutPage.fillForm(fullData.visitor);
  await checkoutPage.submitPayment();

  // Complete Stripe payment (requires stripe helper)
  // await completeStripeCheckout(page);

  // Return confirmation page
  const confirmationPage = new ConfirmationPage(page);
  const bookingReference = await confirmationPage.getBookingReference();

  return { confirmationPage, bookingReference };
}

/**
 * Assert that booking summary matches expected data
 */
export async function assertBookingSummary(
  checkoutPage: CheckoutPage,
  expected: {
    experienceTitle?: string;
    date?: string;
    time?: string;
    guests?: number;
    total?: number;
  }
): Promise<void> {
  const summary = await checkoutPage.getSummary();

  if (expected.experienceTitle) {
    expect(summary.experienceTitle).toContain(expected.experienceTitle);
  }

  if (expected.date) {
    expect(summary.date).toContain(formatDisplayDate(expected.date));
  }

  if (expected.guests) {
    expect(summary.guests).toContain(String(expected.guests));
  }

  if (expected.total) {
    expect(summary.total).toContain(formatPrice(expected.total));
  }
}

/**
 * Assert that confirmation page shows correct booking details
 */
export async function assertConfirmationDetails(
  confirmationPage: ConfirmationPage,
  expected: {
    experienceTitle?: string;
    date?: string;
    guests?: number;
    total?: number;
    status?: string;
  }
): Promise<void> {
  if (expected.status) {
    const status = await confirmationPage.getStatus();
    expect(status.toLowerCase()).toContain(expected.status.toLowerCase());
  }

  const details = await confirmationPage.getBookingDetails();

  if (expected.experienceTitle) {
    expect(details.experienceTitle).toContain(expected.experienceTitle);
  }

  if (expected.date) {
    expect(details.date).toContain(formatDisplayDate(expected.date));
  }

  if (expected.guests) {
    expect(details.guests).toContain(String(expected.guests));
  }

  if (expected.total) {
    expect(details.total).toContain(formatPrice(expected.total));
  }
}

// Import expect for assertions
import { expect } from '@playwright/test';
