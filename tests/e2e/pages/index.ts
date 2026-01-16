/**
 * Page Object Model exports
 *
 * This barrel file exports all page objects for easy importing in tests.
 *
 * Usage:
 * ```typescript
 * import { SearchPage, BookingPage, CheckoutPage } from '../pages';
 * ```
 */

export { BasePage } from './base.page';
export { SearchPage, type ExperienceType, type SortOption } from './search.page';
export { ExperienceDetailPage } from './experience-detail.page';
export { BookingPage } from './booking.page';
export { CheckoutPage, type VisitorFormData } from './checkout.page';
export { ConfirmationPage, type BookingStatus } from './confirmation.page';
export { BookingManagementPage } from './booking-management.page';
