import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object for the Booking functionality
 * The booking form is now integrated into the experience detail page: /experiences/[slug]
 */
export class BookingPage extends BasePage {
  // Experience summary card
  readonly experienceSummary: Locator;
  readonly experienceImage: Locator;
  readonly experienceTitle: Locator;
  readonly experienceWinery: Locator;
  readonly experienceDuration: Locator;
  readonly experienceCapacityRange: Locator;

  // Calendar / Date selection
  readonly calendar: Locator;
  readonly calendarTitle: Locator;
  readonly calendarPrevButton: Locator;
  readonly calendarNextButton: Locator;

  // Time slot selection
  readonly timeSlotSection: Locator;
  readonly timeSlotGrid: Locator;
  readonly timeSlotButtons: Locator;
  readonly timeSlotLoading: Locator;
  readonly timeSlotError: Locator;
  readonly timeSlotRetryButton: Locator;

  // Guest count selection
  readonly guestCountSection: Locator;
  readonly guestCountDisplay: Locator;
  readonly guestIncrementButton: Locator;
  readonly guestDecrementButton: Locator;
  readonly remainingCapacityBadge: Locator;

  // Price display
  readonly priceSection: Locator;
  readonly pricePerPerson: Locator;
  readonly priceBreakdown: Locator;
  readonly totalPrice: Locator;

  // Booking summary (sidebar)
  readonly bookingSummary: Locator;
  readonly summaryDate: Locator;
  readonly summaryTime: Locator;
  readonly summaryGuests: Locator;
  readonly summaryTotal: Locator;

  // Action buttons
  readonly continueButton: Locator;
  readonly backButton: Locator;

  // States
  readonly loadingSpinner: Locator;
  readonly capacityAlert: Locator;

  constructor(page: Page) {
    super(page);

    // Experience summary
    this.experienceSummary = page.getByTestId('experience-summary-card');
    this.experienceImage = this.experienceSummary.locator('img');
    this.experienceTitle =
      this.experienceSummary.getByTestId('experience-title');
    this.experienceWinery = this.experienceSummary.getByTestId('winery-name');
    this.experienceDuration = this.experienceSummary.getByTestId(
      'experience-duration'
    );
    this.experienceCapacityRange =
      this.experienceSummary.getByTestId('capacity-range');

    // Calendar
    this.calendar = page.getByRole('application', { name: /calendar/i });
    this.calendarTitle = page.getByTestId('calendar-title');
    this.calendarPrevButton = page.getByRole('button', {
      name: /previous month/i,
    });
    this.calendarNextButton = page.getByRole('button', { name: /next month/i });

    // Time slots
    this.timeSlotSection = page.getByTestId('time-slot-section');
    this.timeSlotGrid = page.getByTestId('time-slot-grid');
    this.timeSlotButtons = this.timeSlotGrid.getByRole('button');
    this.timeSlotLoading = page.getByTestId('time-slot-loading');
    this.timeSlotError = page.getByTestId('time-slot-error');
    this.timeSlotRetryButton = page.getByRole('button', { name: /retry/i });

    // Guest count
    this.guestCountSection = page.getByTestId('guest-count-section');
    this.guestCountDisplay = page.getByTestId('guest-count-display');
    this.guestIncrementButton = page.getByRole('button', {
      name: /increase|plus|\+/i,
    });
    this.guestDecrementButton = page.getByRole('button', {
      name: /decrease|minus|-/i,
    });
    this.remainingCapacityBadge = page.getByTestId('remaining-capacity');

    // Price
    this.priceSection = page.getByTestId('price-section');
    this.pricePerPerson = page.getByTestId('price-per-person');
    this.priceBreakdown = page.getByTestId('price-breakdown');
    this.totalPrice = page.getByTestId('total-price');

    // Summary
    this.bookingSummary = page.getByTestId('booking-summary');
    this.summaryDate = page.getByTestId('summary-date');
    this.summaryTime = page.getByTestId('summary-time');
    this.summaryGuests = page.getByTestId('summary-guests');
    this.summaryTotal = page.getByTestId('summary-total');

    // Actions
    this.continueButton = page.getByRole('button', {
      name: /continue|checkout/i,
    });
    this.backButton = page.getByRole('link', { name: /back/i });

    // States
    this.loadingSpinner = page.getByTestId('loading-spinner');
    this.capacityAlert = page
      .getByRole('alert')
      .filter({ hasText: /capacity/i });
  }

  /**
   * Navigate to experience page with booking widget
   */
  async navigate(slug: string) {
    await this.goto(`/experiences/${slug}`, {
      waitForSelector: '[data-testid="booking-widget"]',
    });
  }

  /**
   * Navigate with pre-selected values via URL params
   */
  async navigateWithParams(
    slug: string,
    params: { date?: string; time?: string; guests?: number }
  ) {
    const searchParams = new URLSearchParams();
    if (params.date) searchParams.set('date', params.date);
    if (params.time) searchParams.set('time', params.time);
    if (params.guests) searchParams.set('guests', String(params.guests));

    const url = `/experiences/${slug}?${searchParams.toString()}`;
    await this.goto(url);
  }

  // === DATE SELECTION ===

  /**
   * Select a date by day number in the current month view
   */
  async selectDate(day: number) {
    const dateButton = this.calendar.getByRole('button', {
      name: String(day),
      exact: true,
    });
    await dateButton.click();
    await this.waitForTimeSlotsToLoad();
  }

  /**
   * Select a date by full date string (YYYY-MM-DD)
   */
  async selectDateByString(dateString: string) {
    const date = new Date(dateString);
    const day = date.getDate();

    // Navigate to correct month if needed
    await this.navigateToMonth(date.getMonth(), date.getFullYear());
    await this.selectDate(day);
  }

  /**
   * Navigate calendar to a specific month
   */
  async navigateToMonth(targetMonth: number, targetYear: number) {
    // This may need multiple clicks - implement based on calendar component
    const maxAttempts = 12;
    for (let i = 0; i < maxAttempts; i++) {
      const titleText = await this.getText(this.calendarTitle);
      // Parse current month/year from title (e.g., "January 2026")
      const currentDate = new Date(titleText);
      if (
        currentDate.getMonth() === targetMonth &&
        currentDate.getFullYear() === targetYear
      ) {
        return;
      }
      // Determine direction
      const currentTime = currentDate.getTime();
      const targetTime = new Date(targetYear, targetMonth).getTime();
      if (targetTime > currentTime) {
        await this.calendarNextButton.click();
      } else {
        await this.calendarPrevButton.click();
      }
      await this.page.waitForTimeout(100);
    }
  }

  /**
   * Check if a date is available (not disabled)
   */
  async isDateAvailable(day: number): Promise<boolean> {
    const dateButton = this.calendar.getByRole('button', {
      name: String(day),
      exact: true,
    });
    return dateButton.isEnabled();
  }

  /**
   * Get all available dates in current month view
   */
  async getAvailableDates(): Promise<number[]> {
    const buttons = await this.calendar.getByRole('button').all();
    const availableDates: number[] = [];

    for (const button of buttons) {
      const text = await button.textContent();
      const day = parseInt(text ?? '', 10);
      if (!isNaN(day) && (await button.isEnabled())) {
        availableDates.push(day);
      }
    }
    return availableDates;
  }

  /**
   * Get the currently selected date from URL
   */
  getSelectedDate(): string | null {
    return this.getUrlParams().get('date');
  }

  // === TIME SLOT SELECTION ===

  /**
   * Wait for time slots to load after date selection
   */
  async waitForTimeSlotsToLoad() {
    await this.timeSlotLoading
      .waitFor({ state: 'hidden', timeout: 10000 })
      .catch(() => {});
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Select a time slot by time string (e.g., "10:00 AM" or "10:00")
   */
  async selectTimeSlot(time: string) {
    const timeButton = this.timeSlotGrid.getByRole('button', {
      name: new RegExp(time, 'i'),
    });
    await timeButton.click();
    // Wait for guest section to appear
    await this.guestCountSection.waitFor({ state: 'visible' });
  }

  /**
   * Get all available time slots
   */
  async getAvailableTimeSlots(): Promise<string[]> {
    const buttons = await this.timeSlotButtons.all();
    const slots: string[] = [];

    for (const button of buttons) {
      if (await button.isEnabled()) {
        const text = await button.textContent();
        if (text) slots.push(text.trim());
      }
    }
    return slots;
  }

  /**
   * Check if time slots section is visible
   */
  async hasTimeSlots(): Promise<boolean> {
    return this.timeSlotSection.isVisible();
  }

  /**
   * Check if there was an error loading time slots
   */
  async hasTimeSlotError(): Promise<boolean> {
    return this.timeSlotError.isVisible();
  }

  /**
   * Retry loading time slots after error
   */
  async retryLoadTimeSlots() {
    await this.timeSlotRetryButton.click();
    await this.waitForTimeSlotsToLoad();
  }

  /**
   * Get the currently selected time from URL
   */
  getSelectedTime(): string | null {
    return this.getUrlParams().get('time');
  }

  // === GUEST COUNT SELECTION ===

  /**
   * Get the current guest count
   */
  async getGuestCount(): Promise<number> {
    const text = await this.getText(this.guestCountDisplay);
    return parseInt(text, 10);
  }

  /**
   * Set guest count to a specific number
   */
  async setGuestCount(count: number) {
    const current = await this.getGuestCount();
    const diff = count - current;

    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        await this.guestIncrementButton.click();
      }
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) {
        await this.guestDecrementButton.click();
      }
    }
  }

  /**
   * Increment guest count by 1
   */
  async incrementGuests() {
    await this.guestIncrementButton.click();
  }

  /**
   * Decrement guest count by 1
   */
  async decrementGuests() {
    await this.guestDecrementButton.click();
  }

  /**
   * Check if increment button is enabled
   */
  async canIncrementGuests(): Promise<boolean> {
    return this.guestIncrementButton.isEnabled();
  }

  /**
   * Check if decrement button is enabled
   */
  async canDecrementGuests(): Promise<boolean> {
    return this.guestDecrementButton.isEnabled();
  }

  /**
   * Get remaining capacity shown in badge
   */
  async getRemainingCapacity(): Promise<number | null> {
    if (!(await this.remainingCapacityBadge.isVisible())) {
      return null;
    }
    const text = await this.getText(this.remainingCapacityBadge);
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Check if guest count section is visible
   */
  async hasGuestCountSelector(): Promise<boolean> {
    return this.guestCountSection.isVisible();
  }

  // === PRICE DISPLAY ===

  /**
   * Get the price per person
   */
  async getPricePerPerson(): Promise<string> {
    return this.getText(this.pricePerPerson);
  }

  /**
   * Get the total price
   */
  async getTotalPrice(): Promise<string> {
    return this.getText(this.totalPrice);
  }

  /**
   * Get the price breakdown text
   */
  async getPriceBreakdown(): Promise<string> {
    return this.getText(this.priceBreakdown);
  }

  // === BOOKING SUMMARY ===

  /**
   * Check if booking summary is visible (all selections made)
   */
  async hasSummary(): Promise<boolean> {
    return this.bookingSummary.isVisible();
  }

  /**
   * Get the full booking summary
   */
  async getSummary(): Promise<{
    date: string;
    time: string;
    guests: string;
    total: string;
  }> {
    return {
      date: await this.getText(this.summaryDate),
      time: await this.getText(this.summaryTime),
      guests: await this.getText(this.summaryGuests),
      total: await this.getText(this.summaryTotal),
    };
  }

  // === NAVIGATION ===

  /**
   * Check if continue button is enabled
   */
  async canContinue(): Promise<boolean> {
    return this.continueButton.isEnabled();
  }

  /**
   * Click continue to proceed to checkout
   */
  async continueToCheckout() {
    await this.continueButton.click();
    await this.page.waitForURL(/\/checkout/);
  }

  /**
   * Click back to return to experience list
   */
  async goBack() {
    await this.backButton.click();
    await this.page.waitForURL(/\/experiences/);
  }

  // === COMPLETE BOOKING SELECTION ===

  /**
   * Complete the full booking selection flow
   */
  async selectBooking(options: { date: string; time: string; guests: number }) {
    await this.selectDateByString(options.date);
    await this.selectTimeSlot(options.time);
    await this.setGuestCount(options.guests);
  }

  /**
   * Complete booking selection and proceed to checkout
   */
  async selectAndContinue(options: {
    date: string;
    time: string;
    guests: number;
  }) {
    await this.selectBooking(options);
    await this.continueToCheckout();
  }
}
