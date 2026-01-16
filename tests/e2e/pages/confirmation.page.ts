import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Booking status types
 */
export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'CANCELLED_BY_CLIENT'
  | 'CANCELLED_BY_HOST'
  | 'COMPLETED';

/**
 * Page Object for the Booking Confirmation page
 * Route: /booking/[id]/confirmation
 */
export class ConfirmationPage extends BasePage {
  // Status section
  readonly statusIcon: Locator;
  readonly statusBadge: Locator;
  readonly statusMessage: Locator;

  // Booking reference
  readonly bookingReference: Locator;
  readonly referenceLabel: Locator;

  // Experience details card
  readonly experienceCard: Locator;
  readonly experienceImage: Locator;
  readonly experienceTitle: Locator;
  readonly bookingDate: Locator;
  readonly bookingTime: Locator;
  readonly guestCount: Locator;
  readonly totalPaid: Locator;

  // Add to calendar
  readonly addToCalendarButton: Locator;

  // Winery details card
  readonly wineryCard: Locator;
  readonly wineryName: Locator;
  readonly wineryAddress: Locator;
  readonly wineryMapLink: Locator;
  readonly wineryPhone: Locator;
  readonly wineryEmail: Locator;

  // Cancellation policy
  readonly cancellationPolicy: Locator;

  // Visitor details
  readonly visitorCard: Locator;
  readonly visitorName: Locator;
  readonly visitorEmail: Locator;
  readonly visitorPhone: Locator;

  // Email confirmation note
  readonly emailConfirmationNote: Locator;

  // Navigation links
  readonly viewExperienceLink: Locator;
  readonly browseMoreLink: Locator;

  constructor(page: Page) {
    super(page);

    // Status
    this.statusIcon = page.getByTestId('status-icon');
    this.statusBadge = page.getByTestId('status-badge');
    this.statusMessage = page.getByTestId('status-message');

    // Reference
    this.bookingReference = page.getByTestId('booking-reference');
    this.referenceLabel = page.getByText(/booking reference/i);

    // Experience card
    this.experienceCard = page.getByTestId('experience-details-card');
    this.experienceImage = this.experienceCard.locator('img');
    this.experienceTitle = page.getByTestId('experience-title');
    this.bookingDate = page.getByTestId('booking-date');
    this.bookingTime = page.getByTestId('booking-time');
    this.guestCount = page.getByTestId('guest-count');
    this.totalPaid = page.getByTestId('total-paid');

    // Calendar
    this.addToCalendarButton = page.getByRole('button', { name: /add to calendar/i });

    // Winery card
    this.wineryCard = page.getByTestId('winery-details-card');
    this.wineryName = page.getByTestId('winery-name');
    this.wineryAddress = page.getByTestId('winery-address');
    this.wineryMapLink = page.getByRole('link', { name: /directions|map/i });
    this.wineryPhone = page.getByRole('link', { name: /\+?\d/ }).first();
    this.wineryEmail = page.getByRole('link', { name: /@/ });

    // Cancellation
    this.cancellationPolicy = page.getByTestId('cancellation-policy');

    // Visitor
    this.visitorCard = page.getByTestId('visitor-details-card');
    this.visitorName = page.getByTestId('visitor-name');
    this.visitorEmail = page.getByTestId('visitor-email');
    this.visitorPhone = page.getByTestId('visitor-phone');

    // Email note
    this.emailConfirmationNote = page.getByText(/confirmation.*sent|email.*sent/i);

    // Navigation
    this.viewExperienceLink = page.getByRole('link', { name: /view experience/i });
    this.browseMoreLink = page.getByRole('link', { name: /browse more|explore/i });
  }

  /**
   * Navigate directly to a confirmation page
   */
  async navigate(bookingId: string) {
    await this.goto(`/booking/${bookingId}/confirmation`, {
      waitForSelector: '[data-testid="booking-reference"]',
    });
  }

  // === STATUS ===

  /**
   * Get the booking status from the badge
   */
  async getStatus(): Promise<string> {
    return this.getText(this.statusBadge);
  }

  /**
   * Check if booking is confirmed
   */
  async isConfirmed(): Promise<boolean> {
    const status = await this.getStatus();
    return status.toLowerCase().includes('confirmed');
  }

  /**
   * Check if status shows pending payment
   */
  async isPendingPayment(): Promise<boolean> {
    const status = await this.getStatus();
    return status.toLowerCase().includes('pending');
  }

  /**
   * Check if the success icon is shown (green check)
   */
  async hasSuccessIcon(): Promise<boolean> {
    // Check for success styling - implementation depends on how icon is rendered
    const iconClass = await this.statusIcon.getAttribute('class');
    return iconClass?.includes('success') || iconClass?.includes('green') || false;
  }

  // === BOOKING REFERENCE ===

  /**
   * Get the booking reference number
   */
  async getBookingReference(): Promise<string> {
    return this.getText(this.bookingReference);
  }

  /**
   * Verify booking reference format (EC-XXXXXXXX)
   */
  async hasValidReferenceFormat(): Promise<boolean> {
    const reference = await this.getBookingReference();
    return /^EC-[A-Z0-9]+$/i.test(reference);
  }

  // === BOOKING DETAILS ===

  /**
   * Get all booking details
   */
  async getBookingDetails(): Promise<{
    experienceTitle: string;
    date: string;
    time: string;
    guests: string;
    total: string;
  }> {
    return {
      experienceTitle: await this.getText(this.experienceTitle),
      date: await this.getText(this.bookingDate),
      time: await this.getText(this.bookingTime),
      guests: await this.getText(this.guestCount),
      total: await this.getText(this.totalPaid),
    };
  }

  /**
   * Get the experience title
   */
  async getExperienceTitle(): Promise<string> {
    return this.getText(this.experienceTitle);
  }

  /**
   * Get the booking date (formatted)
   */
  async getBookingDate(): Promise<string> {
    return this.getText(this.bookingDate);
  }

  /**
   * Get the booking time
   */
  async getBookingTime(): Promise<string> {
    return this.getText(this.bookingTime);
  }

  /**
   * Get the guest count
   */
  async getGuestCount(): Promise<string> {
    return this.getText(this.guestCount);
  }

  /**
   * Get the total paid amount
   */
  async getTotalPaid(): Promise<string> {
    return this.getText(this.totalPaid);
  }

  // === WINERY DETAILS ===

  /**
   * Get winery contact information
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

  /**
   * Click the map/directions link
   */
  async clickMapLink() {
    await this.wineryMapLink.click();
  }

  /**
   * Click the phone number link
   */
  async clickPhoneLink() {
    await this.wineryPhone.click();
  }

  /**
   * Click the email link
   */
  async clickEmailLink() {
    await this.wineryEmail.click();
  }

  /**
   * Check if phone link is clickable (tel: link)
   */
  async hasClickablePhone(): Promise<boolean> {
    const href = await this.wineryPhone.getAttribute('href');
    return href?.startsWith('tel:') ?? false;
  }

  /**
   * Check if email link is clickable (mailto: link)
   */
  async hasClickableEmail(): Promise<boolean> {
    const href = await this.wineryEmail.getAttribute('href');
    return href?.startsWith('mailto:') ?? false;
  }

  // === CALENDAR ===

  /**
   * Check if Add to Calendar button is visible
   */
  async hasAddToCalendar(): Promise<boolean> {
    return this.addToCalendarButton.isVisible();
  }

  /**
   * Click Add to Calendar and handle download
   */
  async clickAddToCalendar(): Promise<{ filename: string; content: string } | null> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.addToCalendarButton.click();

    try {
      const download = await downloadPromise;
      const path = await download.path();
      const fs = await import('fs');
      const content = fs.readFileSync(path!, 'utf-8');
      return {
        filename: download.suggestedFilename(),
        content,
      };
    } catch {
      return null;
    }
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

  // === NAVIGATION ===

  /**
   * Click to view the experience
   */
  async clickViewExperience() {
    await this.viewExperienceLink.click();
    await this.page.waitForURL(/\/experiences\//);
  }

  /**
   * Click to browse more experiences
   */
  async clickBrowseMore() {
    await this.browseMoreLink.click();
    await this.page.waitForURL(/\/(experiences)?$/);
  }

  // === POLICIES ===

  /**
   * Check if cancellation policy is displayed
   */
  async hasCancellationPolicy(): Promise<boolean> {
    return this.cancellationPolicy.isVisible();
  }

  /**
   * Get cancellation policy text
   */
  async getCancellationPolicyText(): Promise<string> {
    return this.getText(this.cancellationPolicy);
  }

  // === EMAIL CONFIRMATION ===

  /**
   * Check if email confirmation note is shown
   */
  async hasEmailConfirmationNote(): Promise<boolean> {
    return this.emailConfirmationNote.isVisible();
  }
}
