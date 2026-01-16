import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object for the Booking Management / Details page
 * Route: /booking/[id]?token=[accessToken]
 *
 * This page allows guests to view and manage their bookings,
 * including cancellation functionality.
 */
export class BookingManagementPage extends BasePage {
  // Status section
  readonly statusIcon: Locator;
  readonly statusBadge: Locator;

  // Booking reference
  readonly bookingReference: Locator;

  // Experience details
  readonly experienceCard: Locator;
  readonly experienceTitle: Locator;
  readonly experienceImage: Locator;
  readonly bookingDate: Locator;
  readonly bookingTime: Locator;
  readonly guestCount: Locator;
  readonly totalPaid: Locator;

  // Winery details
  readonly wineryCard: Locator;
  readonly wineryName: Locator;
  readonly wineryAddress: Locator;
  readonly wineryPhone: Locator;
  readonly wineryEmail: Locator;

  // Visitor details
  readonly visitorCard: Locator;
  readonly visitorName: Locator;
  readonly visitorEmail: Locator;
  readonly visitorPhone: Locator;

  // Cancel booking button
  readonly cancelBookingButton: Locator;

  // Cancellation modal
  readonly cancellationModal: Locator;
  readonly modalTitle: Locator;
  readonly modalWarningIcon: Locator;
  readonly policyExplanation: Locator;

  // Refund information in modal
  readonly refundEligibleSection: Locator;
  readonly noRefundSection: Locator;
  readonly refundAmount: Locator;
  readonly hoursRemaining: Locator;

  // Confirmation checkbox and buttons
  readonly confirmCheckbox: Locator;
  readonly confirmCancelButton: Locator;
  readonly closeModalButton: Locator;

  // Success/error states
  readonly cancellationSuccessToast: Locator;
  readonly cancellationErrorToast: Locator;

  // Access denied
  readonly accessDeniedMessage: Locator;
  readonly invalidTokenMessage: Locator;

  constructor(page: Page) {
    super(page);

    // Status
    this.statusIcon = page.getByTestId('status-icon');
    this.statusBadge = page.getByTestId('booking-status');

    // Reference
    this.bookingReference = page.getByTestId('booking-reference');

    // Experience
    this.experienceCard = page.getByTestId('experience-details-card');
    this.experienceTitle = page.getByTestId('experience-title');
    this.experienceImage = this.experienceCard.locator('img');
    this.bookingDate = page.getByTestId('booking-date');
    this.bookingTime = page.getByTestId('booking-time');
    this.guestCount = page.getByTestId('guest-count');
    this.totalPaid = page.getByTestId('total-paid');

    // Winery
    this.wineryCard = page.getByTestId('winery-details-card');
    this.wineryName = page.getByTestId('winery-name');
    this.wineryAddress = page.getByTestId('winery-address');
    this.wineryPhone = page.getByRole('link', { name: /\+?\d/ }).first();
    this.wineryEmail = page.getByRole('link', { name: /@/ });

    // Visitor
    this.visitorCard = page.getByTestId('visitor-details-card');
    this.visitorName = page.getByTestId('visitor-name');
    this.visitorEmail = page.getByTestId('visitor-email');
    this.visitorPhone = page.getByTestId('visitor-phone');

    // Cancel button
    this.cancelBookingButton = page.getByRole('button', { name: /cancel booking/i });

    // Modal
    this.cancellationModal = page.getByRole('dialog', { name: /cancel/i });
    this.modalTitle = this.cancellationModal.getByRole('heading');
    this.modalWarningIcon = this.cancellationModal.getByTestId('warning-icon');
    this.policyExplanation = this.cancellationModal.getByTestId('policy-explanation');

    // Refund info
    this.refundEligibleSection = page.getByTestId('refund-eligible');
    this.noRefundSection = page.getByTestId('no-refund');
    this.refundAmount = page.getByTestId('refund-amount');
    this.hoursRemaining = page.getByTestId('hours-remaining');

    // Confirmation
    this.confirmCheckbox = page.getByRole('checkbox', { name: /understand/i });
    this.confirmCancelButton = this.cancellationModal.getByRole('button', { name: /cancel/i });
    this.closeModalButton = this.cancellationModal.getByRole('button', { name: /close|×/i });

    // Toasts
    this.cancellationSuccessToast = page.getByRole('alert').filter({ hasText: /cancelled/i });
    this.cancellationErrorToast = page.getByRole('alert').filter({ hasText: /error|failed/i });

    // Access errors
    this.accessDeniedMessage = page.getByText(/access denied/i);
    this.invalidTokenMessage = page.getByText(/invalid.*token|token.*invalid/i);
  }

  /**
   * Navigate to booking management page with access token
   */
  async navigate(bookingId: string, accessToken: string) {
    await this.goto(`/booking/${bookingId}?token=${accessToken}`, {
      waitForSelector: '[data-testid="booking-reference"], [data-testid="access-denied"]',
    });
  }

  /**
   * Navigate without token (should show access denied)
   */
  async navigateWithoutToken(bookingId: string) {
    await this.goto(`/booking/${bookingId}`);
  }

  // === STATUS ===

  /**
   * Get the current booking status
   */
  async getBookingStatus(): Promise<string> {
    return this.getText(this.statusBadge);
  }

  /**
   * Check if booking is confirmed
   */
  async isConfirmed(): Promise<boolean> {
    const status = await this.getBookingStatus();
    return status.toLowerCase().includes('confirmed');
  }

  /**
   * Check if booking is cancelled
   */
  async isCancelled(): Promise<boolean> {
    const status = await this.getBookingStatus();
    return status.toLowerCase().includes('cancelled');
  }

  /**
   * Check if booking is completed
   */
  async isCompleted(): Promise<boolean> {
    const status = await this.getBookingStatus();
    return status.toLowerCase().includes('completed');
  }

  // === BOOKING DETAILS ===

  /**
   * Get the booking reference
   */
  async getBookingReference(): Promise<string> {
    return this.getText(this.bookingReference);
  }

  /**
   * Get all booking details
   */
  async getBookingDetails(): Promise<{
    reference: string;
    status: string;
    experienceTitle: string;
    date: string;
    time: string;
    guests: string;
    total: string;
  }> {
    return {
      reference: await this.getBookingReference(),
      status: await this.getBookingStatus(),
      experienceTitle: await this.getText(this.experienceTitle),
      date: await this.getText(this.bookingDate),
      time: await this.getText(this.bookingTime),
      guests: await this.getText(this.guestCount),
      total: await this.getText(this.totalPaid),
    };
  }

  // === CANCELLATION ===

  /**
   * Check if cancel button is visible
   */
  async canCancel(): Promise<boolean> {
    return this.cancelBookingButton.isVisible();
  }

  /**
   * Open the cancellation modal
   */
  async openCancellationModal() {
    await this.cancelBookingButton.click();
    await this.cancellationModal.waitFor({ state: 'visible' });
  }

  /**
   * Close the cancellation modal
   */
  async closeCancellationModal() {
    await this.closeModalButton.click();
    await this.cancellationModal.waitFor({ state: 'hidden' });
  }

  /**
   * Check if modal is open
   */
  async isModalOpen(): Promise<boolean> {
    return this.cancellationModal.isVisible();
  }

  /**
   * Check if refund is available
   */
  async isRefundEligible(): Promise<boolean> {
    return this.refundEligibleSection.isVisible();
  }

  /**
   * Check if no refund section is shown
   */
  async hasNoRefundWarning(): Promise<boolean> {
    return this.noRefundSection.isVisible();
  }

  /**
   * Get the refund amount if eligible
   */
  async getRefundAmount(): Promise<string> {
    if (await this.isRefundEligible()) {
      return this.getText(this.refundAmount);
    }
    return '';
  }

  /**
   * Get hours remaining until experience
   */
  async getHoursRemaining(): Promise<string> {
    return this.getText(this.hoursRemaining);
  }

  /**
   * Get cancellation info from modal
   */
  async getCancellationInfo(): Promise<{
    isRefundEligible: boolean;
    refundAmount: string;
    hoursRemaining: string;
  }> {
    return {
      isRefundEligible: await this.isRefundEligible(),
      refundAmount: await this.getRefundAmount(),
      hoursRemaining: await this.getHoursRemaining(),
    };
  }

  /**
   * Check if confirm button is enabled
   */
  async isConfirmButtonEnabled(): Promise<boolean> {
    return this.confirmCancelButton.isEnabled();
  }

  /**
   * Check the confirmation checkbox
   */
  async checkConfirmation() {
    await this.confirmCheckbox.check();
  }

  /**
   * Uncheck the confirmation checkbox
   */
  async uncheckConfirmation() {
    await this.confirmCheckbox.uncheck();
  }

  /**
   * Check if confirmation checkbox is checked
   */
  async isConfirmationChecked(): Promise<boolean> {
    return this.confirmCheckbox.isChecked();
  }

  /**
   * Click the confirm cancel button
   */
  async clickConfirmCancel() {
    await this.confirmCancelButton.click();
  }

  /**
   * Complete the full cancellation flow
   */
  async confirmCancellation() {
    await this.checkConfirmation();
    await this.clickConfirmCancel();
    // Wait for modal to close and page to update
    await this.cancellationModal.waitFor({ state: 'hidden' });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Open modal and complete cancellation
   */
  async cancelBooking() {
    await this.openCancellationModal();
    await this.confirmCancellation();
  }

  // === SUCCESS / ERROR STATES ===

  /**
   * Check if cancellation success toast is shown
   */
  async hasCancellationSuccessToast(): Promise<boolean> {
    return this.cancellationSuccessToast.isVisible();
  }

  /**
   * Check if cancellation error toast is shown
   */
  async hasCancellationErrorToast(): Promise<boolean> {
    return this.cancellationErrorToast.isVisible();
  }

  /**
   * Wait for success toast to appear
   */
  async waitForSuccessToast() {
    await this.cancellationSuccessToast.waitFor({ state: 'visible', timeout: 10000 });
  }

  // === ACCESS CONTROL ===

  /**
   * Check if access is denied
   */
  async isAccessDenied(): Promise<boolean> {
    return this.accessDeniedMessage.isVisible();
  }

  /**
   * Check if token is invalid
   */
  async hasInvalidToken(): Promise<boolean> {
    return this.invalidTokenMessage.isVisible();
  }

  // === WINERY DETAILS ===

  /**
   * Get winery contact details
   */
  async getWineryDetails(): Promise<{
    name: string;
    address: string;
  }> {
    return {
      name: await this.getText(this.wineryName),
      address: await this.getText(this.wineryAddress),
    };
  }

  // === VISITOR DETAILS ===

  /**
   * Get visitor details
   */
  async getVisitorDetails(): Promise<{
    name: string;
    email: string;
    phone: string;
  }> {
    return {
      name: await this.getText(this.visitorName),
      email: await this.getText(this.visitorEmail),
      phone: await this.getText(this.visitorPhone),
    };
  }
}
