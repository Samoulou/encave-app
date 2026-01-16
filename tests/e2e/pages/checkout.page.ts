import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Visitor form data structure
 */
export interface VisitorFormData {
  name: string;
  email: string;
  phone: string;
}

/**
 * Page Object for the Checkout page
 * Route: /experiences/[slug]/checkout?date=...&time=...&guests=...
 */
export class CheckoutPage extends BasePage {
  // Availability verification
  readonly availabilityAlert: Locator;
  readonly availabilityVerifying: Locator;
  readonly availabilityError: Locator;
  readonly capacityExceededAlert: Locator;
  readonly adjustBookingLink: Locator;

  // Form fields
  readonly form: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;

  // Validation errors
  readonly nameError: Locator;
  readonly emailError: Locator;
  readonly phoneError: Locator;

  // Booking summary sidebar
  readonly bookingSummary: Locator;
  readonly summaryExperienceTitle: Locator;
  readonly summaryWineryName: Locator;
  readonly summaryDate: Locator;
  readonly summaryTime: Locator;
  readonly summaryGuests: Locator;
  readonly summaryPricePerPerson: Locator;
  readonly summaryTotal: Locator;
  readonly summaryCapacityBadge: Locator;

  // Payment button
  readonly payButton: Locator;
  readonly processingIndicator: Locator;

  // Security note
  readonly securePaymentNote: Locator;

  // Error states
  readonly errorAlert: Locator;
  readonly missingParamsError: Locator;
  readonly paymentCancelledAlert: Locator;
  readonly paymentFailedAlert: Locator;

  constructor(page: Page) {
    super(page);

    // Availability
    this.availabilityAlert = page.getByTestId('availability-alert');
    this.availabilityVerifying = page.getByText(/verifying availability/i);
    this.availabilityError = page.getByTestId('availability-error');
    this.capacityExceededAlert = page.getByRole('alert').filter({ hasText: /capacity.*exceeded/i });
    this.adjustBookingLink = page.getByRole('link', { name: /adjust|change|modify/i });

    // Form
    this.form = page.getByTestId('checkout-form');
    this.nameInput = page.getByLabel(/^name/i);
    this.emailInput = page.getByLabel(/email/i);
    this.phoneInput = page.getByLabel(/phone/i);

    // Validation errors - locate by aria-describedby or adjacent error elements
    this.nameError = page.getByTestId('name-error');
    this.emailError = page.getByTestId('email-error');
    this.phoneError = page.getByTestId('phone-error');

    // Summary
    this.bookingSummary = page.getByTestId('checkout-summary');
    this.summaryExperienceTitle = page.getByTestId('summary-experience-title');
    this.summaryWineryName = page.getByTestId('summary-winery-name');
    this.summaryDate = page.getByTestId('summary-date');
    this.summaryTime = page.getByTestId('summary-time');
    this.summaryGuests = page.getByTestId('summary-guests');
    this.summaryPricePerPerson = page.getByTestId('summary-price-per-person');
    this.summaryTotal = page.getByTestId('summary-total');
    this.summaryCapacityBadge = page.getByTestId('summary-capacity-badge');

    // Payment
    this.payButton = page.getByRole('button', { name: /pay/i });
    this.processingIndicator = page.getByText(/processing/i);

    // Security
    this.securePaymentNote = page.getByText(/secure payment/i);

    // Errors
    this.errorAlert = page.getByRole('alert').filter({ hasText: /error/i });
    this.missingParamsError = page.getByText(/missing.*required|parameters.*missing/i);
    this.paymentCancelledAlert = page.getByRole('alert').filter({ hasText: /cancel/i });
    this.paymentFailedAlert = page.getByRole('alert').filter({ hasText: /fail/i });
  }

  /**
   * Navigate to checkout with required params
   */
  async navigate(
    slug: string,
    params: {
      date: string;
      time: string;
      guests: number;
    }
  ) {
    const searchParams = new URLSearchParams({
      date: params.date,
      time: params.time,
      guests: String(params.guests),
    });

    await this.goto(`/experiences/${slug}/checkout?${searchParams.toString()}`);
    await this.waitForAvailabilityCheck();
  }

  /**
   * Navigate to checkout without params (should show error)
   */
  async navigateWithoutParams(slug: string) {
    await this.goto(`/experiences/${slug}/checkout`);
  }

  /**
   * Wait for the initial availability check to complete
   */
  async waitForAvailabilityCheck() {
    // Wait for verifying message to disappear
    await this.availabilityVerifying.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  // === FORM INTERACTIONS ===

  /**
   * Fill the visitor name field
   */
  async fillName(name: string) {
    await this.nameInput.fill(name);
  }

  /**
   * Fill the email field
   */
  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  /**
   * Fill the phone field
   */
  async fillPhone(phone: string) {
    await this.phoneInput.fill(phone);
  }

  /**
   * Fill all form fields
   */
  async fillForm(data: VisitorFormData) {
    await this.fillName(data.name);
    await this.fillEmail(data.email);
    await this.fillPhone(data.phone);
  }

  /**
   * Clear all form fields
   */
  async clearForm() {
    await this.nameInput.clear();
    await this.emailInput.clear();
    await this.phoneInput.clear();
  }

  /**
   * Get current form values
   */
  async getFormValues(): Promise<VisitorFormData> {
    return {
      name: (await this.nameInput.inputValue()) ?? '',
      email: (await this.emailInput.inputValue()) ?? '',
      phone: (await this.phoneInput.inputValue()) ?? '',
    };
  }

  // === VALIDATION ===

  /**
   * Check if name field has validation error
   */
  async hasNameError(): Promise<boolean> {
    return this.nameError.isVisible();
  }

  /**
   * Get name validation error text
   */
  async getNameError(): Promise<string> {
    return this.getText(this.nameError);
  }

  /**
   * Check if email field has validation error
   */
  async hasEmailError(): Promise<boolean> {
    return this.emailError.isVisible();
  }

  /**
   * Get email validation error text
   */
  async getEmailError(): Promise<string> {
    return this.getText(this.emailError);
  }

  /**
   * Check if phone field has validation error
   */
  async hasPhoneError(): Promise<boolean> {
    return this.phoneError.isVisible();
  }

  /**
   * Get phone validation error text
   */
  async getPhoneError(): Promise<string> {
    return this.getText(this.phoneError);
  }

  /**
   * Check if any validation errors are present
   */
  async hasValidationErrors(): Promise<boolean> {
    return (
      (await this.hasNameError()) || (await this.hasEmailError()) || (await this.hasPhoneError())
    );
  }

  /**
   * Get all validation errors
   */
  async getAllValidationErrors(): Promise<{
    name?: string;
    email?: string;
    phone?: string;
  }> {
    const errors: { name?: string; email?: string; phone?: string } = {};
    if (await this.hasNameError()) errors.name = await this.getNameError();
    if (await this.hasEmailError()) errors.email = await this.getEmailError();
    if (await this.hasPhoneError()) errors.phone = await this.getPhoneError();
    return errors;
  }

  // === BOOKING SUMMARY ===

  /**
   * Get the booking summary details
   */
  async getSummary(): Promise<{
    experienceTitle: string;
    wineryName: string;
    date: string;
    time: string;
    guests: string;
    pricePerPerson: string;
    total: string;
  }> {
    return {
      experienceTitle: await this.getText(this.summaryExperienceTitle),
      wineryName: await this.getText(this.summaryWineryName),
      date: await this.getText(this.summaryDate),
      time: await this.getText(this.summaryTime),
      guests: await this.getText(this.summaryGuests),
      pricePerPerson: await this.getText(this.summaryPricePerPerson),
      total: await this.getText(this.summaryTotal),
    };
  }

  /**
   * Get the total amount from the pay button
   */
  async getPayButtonAmount(): Promise<string> {
    const buttonText = await this.getText(this.payButton);
    // Extract amount from "Pay CHF 200" or similar
    const match = buttonText.match(/[\d.,]+/);
    return match ? match[0] : '';
  }

  // === AVAILABILITY STATUS ===

  /**
   * Check if capacity exceeded alert is shown
   */
  async hasCapacityExceededAlert(): Promise<boolean> {
    return this.capacityExceededAlert.isVisible();
  }

  /**
   * Click link to adjust booking (when capacity exceeded)
   */
  async clickAdjustBooking() {
    await this.adjustBookingLink.click();
    await this.page.waitForURL(/\/book/);
  }

  /**
   * Check if availability error is shown
   */
  async hasAvailabilityError(): Promise<boolean> {
    return this.availabilityError.isVisible();
  }

  // === PAYMENT ===

  /**
   * Check if pay button is enabled
   */
  async canPay(): Promise<boolean> {
    return this.payButton.isEnabled();
  }

  /**
   * Click the pay button
   */
  async clickPay() {
    await this.payButton.click();
  }

  /**
   * Submit payment and wait for Stripe redirect
   */
  async submitPayment() {
    await this.clickPay();
    await this.page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
  }

  /**
   * Check if processing indicator is shown
   */
  async isProcessing(): Promise<boolean> {
    return this.processingIndicator.isVisible();
  }

  // === ERROR STATES ===

  /**
   * Check if missing params error is shown
   */
  async hasMissingParamsError(): Promise<boolean> {
    return this.missingParamsError.isVisible();
  }

  /**
   * Check if payment cancelled alert is shown
   */
  async hasPaymentCancelledAlert(): Promise<boolean> {
    return this.paymentCancelledAlert.isVisible();
  }

  /**
   * Check if payment failed alert is shown
   */
  async hasPaymentFailedAlert(): Promise<boolean> {
    return this.paymentFailedAlert.isVisible();
  }

  // === COMPLETE CHECKOUT FLOW ===

  /**
   * Fill form and submit payment
   */
  async completeCheckout(visitorData: VisitorFormData) {
    await this.fillForm(visitorData);
    await this.submitPayment();
  }
}
