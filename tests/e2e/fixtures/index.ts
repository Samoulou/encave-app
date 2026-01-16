/**
 * Test Fixtures exports
 *
 * This barrel file exports all fixtures for easy importing in tests.
 *
 * Usage:
 * ```typescript
 * // For booking-related tests
 * import { test, expect } from './fixtures/booking.fixture';
 *
 * // For auth-related tests
 * import { test, expect } from './fixtures/auth.fixture';
 *
 * // For test data only
 * import { TEST_EXPERIENCES, TEST_VISITORS, createTestBooking } from './fixtures/test-data';
 * ```
 */

// Test data types and factories
export * from './test-data';

// Auth fixtures
export {
  test as authTest,
  expect as authExpect,
  TEST_USERS,
  AUTH_STATE_PATHS,
  saveAuthState,
  type AuthFixtures,
  type TestUser,
} from './auth.fixture';

// Booking fixtures
export {
  test as bookingTest,
  expect as bookingExpect,
  completeFullBookingFlow,
  assertBookingSummary,
  assertConfirmationDetails,
  type BookingFixtures,
  type BookingSelection,
  type CompleteBookingData,
} from './booking.fixture';
