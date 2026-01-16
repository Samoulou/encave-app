# E2E Test Design: Full Guest Journey

**Date:** 2026-01-16
**Designer:** Quinn (Test Architect)
**Scope:** Complete guest user journey from discovery to cancellation

---

## Test Strategy Overview

| Metric | Count |
|--------|-------|
| **Total E2E Scenarios** | 47 |
| **P0 (Critical)** | 18 |
| **P1 (High)** | 19 |
| **P2 (Medium)** | 10 |

**Flows Covered:**
1. Search & Discovery (8 scenarios)
2. Experience Details (6 scenarios)
3. Booking Flow (10 scenarios)
4. Checkout & Payment (11 scenarios)
5. Confirmation (6 scenarios)
6. Cancellation (6 scenarios)

---

## Page Object Model Structure

```
tests/e2e/
├── fixtures/
│   ├── auth.fixture.ts          # Authenticated user state
│   ├── test-data.fixture.ts     # Test data seeding
│   └── booking.fixture.ts       # Pre-created booking state
├── pages/
│   ├── search.page.ts           # Search & filters
│   ├── experience-detail.page.ts
│   ├── booking.page.ts          # Date/time/guest selection
│   ├── checkout.page.ts         # Payment form
│   ├── confirmation.page.ts
│   └── booking-management.page.ts
├── flows/
│   ├── guest-discovery.spec.ts
│   ├── guest-booking.spec.ts
│   ├── guest-checkout.spec.ts
│   └── guest-cancellation.spec.ts
└── utils/
    ├── stripe-mock.ts           # Stripe test helpers
    └── date-helpers.ts          # Date manipulation
```

---

## 1. Search & Discovery Flow

**Route:** `/experiences`
**File:** `tests/e2e/flows/guest-discovery.spec.ts`

### Test Scenarios

| ID | Priority | Scenario | Given-When-Then |
|----|----------|----------|-----------------|
| GJ-DISC-001 | P0 | Search page loads with experiences | **Given** experiences exist in database<br>**When** guest navigates to `/experiences`<br>**Then** page displays experience cards in grid layout<br>**And** each card shows title, winery, price, duration |
| GJ-DISC-002 | P1 | Text search filters results | **Given** guest is on search page<br>**When** guest types "wine tasting" in search box<br>**Then** results filter after 300ms debounce<br>**And** URL updates with `?q=wine+tasting`<br>**And** only matching experiences display |
| GJ-DISC-003 | P1 | Experience type filter works | **Given** guest is on search page<br>**When** guest selects "Cellar Visit" checkbox<br>**Then** results show only CELLAR_VISIT type<br>**And** URL updates with `?type=CELLAR_VISIT` |
| GJ-DISC-004 | P1 | Multiple filters combine correctly | **Given** guest is on search page<br>**When** guest selects type "TASTING" AND commune "Lausanne"<br>**Then** results match BOTH criteria<br>**And** URL contains both parameters |
| GJ-DISC-005 | P1 | Price range filter works | **Given** guest is on search page<br>**When** guest sets min=50 and max=100 CHF<br>**Then** only experiences in range display<br>**And** URL contains `minPrice` and `maxPrice` |
| GJ-DISC-006 | P2 | Sort by price ascending | **Given** guest has search results<br>**When** guest selects "Price: Low to High"<br>**Then** results reorder by price ascending<br>**And** URL updates with `?sort=price_asc` |
| GJ-DISC-007 | P2 | Pagination works correctly | **Given** more than 12 experiences exist<br>**When** guest clicks page 2<br>**Then** next set of results displays<br>**And** URL updates with `?page=2` |
| GJ-DISC-008 | P1 | Filter state persists via URL | **Given** guest applies filters and copies URL<br>**When** guest opens URL in new tab<br>**Then** same filters are applied<br>**And** same results display |

### Page Object: `search.page.ts`

```typescript
export class SearchPage {
  readonly searchInput: Locator;
  readonly typeFilters: Record<ExperienceType, Locator>;
  readonly communeSelect: Locator;
  readonly minPriceInput: Locator;
  readonly maxPriceInput: Locator;
  readonly sortSelect: Locator;
  readonly resultsGrid: Locator;
  readonly experienceCards: Locator;
  readonly pagination: Locator;
  readonly clearFiltersButton: Locator;
  readonly resultsCount: Locator;

  constructor(private page: Page) {
    this.searchInput = page.getByPlaceholder(/search experiences/i);
    this.typeFilters = {
      TASTING: page.getByLabel('Tasting'),
      CELLAR_VISIT: page.getByLabel('Cellar Visit'),
      WORKSHOP: page.getByLabel('Workshop'),
      VINEYARD_TOUR: page.getByLabel('Vineyard Tour'),
      FOOD_PAIRING: page.getByLabel('Food Pairing'),
    };
    this.communeSelect = page.getByLabel(/location|commune/i);
    this.minPriceInput = page.getByLabel(/min.*price/i);
    this.maxPriceInput = page.getByLabel(/max.*price/i);
    this.sortSelect = page.getByLabel(/sort/i);
    this.resultsGrid = page.getByTestId('search-results-grid');
    this.experienceCards = page.getByTestId('experience-card');
    this.pagination = page.getByRole('navigation', { name: /pagination/i });
    this.clearFiltersButton = page.getByRole('button', { name: /clear/i });
    this.resultsCount = page.getByTestId('results-count');
  }

  async goto() {
    await this.page.goto('/experiences');
    await this.page.waitForLoadState('networkidle');
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(350); // Wait for debounce
  }

  async filterByType(type: ExperienceType) {
    await this.typeFilters[type].check();
    await this.page.waitForURL(/type=/);
  }

  async setpriceRange(min: number, max: number) {
    await this.minPriceInput.fill(String(min));
    await this.maxPriceInput.fill(String(max));
  }

  async getResultCount(): Promise<number> {
    return this.experienceCards.count();
  }

  async clickExperience(index: number) {
    await this.experienceCards.nth(index).click();
  }
}
```

---

## 2. Experience Details Flow

**Route:** `/experiences/[slug]`
**File:** `tests/e2e/flows/guest-discovery.spec.ts`

### Test Scenarios

| ID | Priority | Scenario | Given-When-Then |
|----|----------|----------|-----------------|
| GJ-EXP-001 | P0 | Experience detail page loads | **Given** experience with slug "wine-tasting-geneva" exists<br>**When** guest navigates to `/experiences/wine-tasting-geneva`<br>**Then** page displays title, description, price<br>**And** hero image loads<br>**And** winery info card displays |
| GJ-EXP-002 | P0 | Book Now button navigates to booking | **Given** guest is on experience detail page<br>**And** winery has Stripe connected<br>**When** guest clicks "Book Now"<br>**Then** guest navigates to `/experiences/[slug]/book` |
| GJ-EXP-003 | P1 | Coming Soon shows for non-Stripe winery | **Given** experience belongs to winery without Stripe<br>**When** guest views experience detail<br>**Then** "Coming Soon" badge displays<br>**And** Book Now button is disabled |
| GJ-EXP-004 | P1 | Availability preview shows schedule | **Given** experience has availability slots<br>**When** guest views experience detail<br>**Then** available days of week display<br>**And** time slots for each day show |
| GJ-EXP-005 | P2 | Related experiences display | **Given** winery has multiple experiences<br>**When** guest views one experience<br>**Then** up to 3 related experiences show<br>**And** each links to its detail page |
| GJ-EXP-006 | P1 | 404 page for invalid slug | **Given** no experience with slug "nonexistent"<br>**When** guest navigates to `/experiences/nonexistent`<br>**Then** 404 page displays<br>**And** link to browse experiences shows |

### Page Object: `experience-detail.page.ts`

```typescript
export class ExperienceDetailPage {
  readonly heroImage: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly price: Locator;
  readonly typeBadge: Locator;
  readonly duration: Locator;
  readonly capacity: Locator;
  readonly bookNowButton: Locator;
  readonly comingSoonBadge: Locator;
  readonly wineryCard: Locator;
  readonly availabilityPreview: Locator;
  readonly relatedExperiences: Locator;
  readonly breadcrumb: Locator;

  constructor(private page: Page) {
    this.heroImage = page.getByTestId('experience-hero-image');
    this.title = page.getByRole('heading', { level: 1 });
    this.description = page.getByTestId('experience-description');
    this.price = page.getByTestId('experience-price');
    this.typeBadge = page.getByTestId('experience-type-badge');
    this.duration = page.getByTestId('experience-duration');
    this.capacity = page.getByTestId('experience-capacity');
    this.bookNowButton = page.getByRole('button', { name: /book now/i });
    this.comingSoonBadge = page.getByText(/coming soon/i);
    this.wineryCard = page.getByTestId('winery-info-card');
    this.availabilityPreview = page.getByTestId('availability-preview');
    this.relatedExperiences = page.getByTestId('related-experiences');
    this.breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i });
  }

  async goto(slug: string) {
    await this.page.goto(`/experiences/${slug}`);
    await this.page.waitForLoadState('networkidle');
  }

  async clickBookNow() {
    await this.bookNowButton.click();
    await this.page.waitForURL(/\/book$/);
  }

  async getPrice(): Promise<string> {
    return this.price.textContent() ?? '';
  }

  async isBookingEnabled(): Promise<boolean> {
    return this.bookNowButton.isEnabled();
  }
}
```

---

## 3. Booking Flow

**Route:** `/experiences/[slug]/book`
**File:** `tests/e2e/flows/guest-booking.spec.ts`

### Test Scenarios

| ID | Priority | Scenario | Given-When-Then |
|----|----------|----------|-----------------|
| GJ-BOOK-001 | P0 | Booking page loads with experience info | **Given** experience is bookable<br>**When** guest navigates to booking page<br>**Then** experience summary card displays<br>**And** calendar is visible<br>**And** no date is pre-selected |
| GJ-BOOK-002 | P0 | Select available date shows time slots | **Given** guest is on booking page<br>**And** January 20 has availability<br>**When** guest clicks January 20 on calendar<br>**Then** time slots for that date load<br>**And** URL updates with `?date=2026-01-20` |
| GJ-BOOK-003 | P0 | Select time slot shows guest selector | **Given** guest has selected a date<br>**And** 10:00 AM slot has capacity<br>**When** guest clicks 10:00 AM slot<br>**Then** guest count selector appears<br>**And** URL updates with `?time=10:00` |
| GJ-BOOK-004 | P0 | Guest count respects capacity limits | **Given** time slot has 6 remaining capacity<br>**And** experience min is 2, max is 10<br>**When** guest adjusts guest count<br>**Then** minimum is 2<br>**And** maximum is 6 (remaining capacity) |
| GJ-BOOK-005 | P0 | Price calculates correctly | **Given** experience costs 50 CHF per person<br>**When** guest selects 4 guests<br>**Then** total shows "CHF 200"<br>**And** breakdown shows "CHF 50 x 4" |
| GJ-BOOK-006 | P1 | Unavailable dates are disabled | **Given** experience only available Mon-Fri<br>**When** guest views calendar<br>**Then** Saturday and Sunday are greyed out<br>**And** clicking them does nothing |
| GJ-BOOK-007 | P1 | Past dates are disabled | **Given** today is January 16<br>**When** guest views calendar<br>**Then** January 1-15 are disabled<br>**And** cannot be selected |
| GJ-BOOK-008 | P1 | Booking summary shows all selections | **Given** guest selected date, time, guests<br>**When** all fields are complete<br>**Then** summary panel shows formatted date<br>**And** time in AM/PM format<br>**And** guest count<br>**And** total price |
| GJ-BOOK-009 | P0 | Continue to checkout enabled when valid | **Given** guest completed all selections<br>**When** form is valid<br>**Then** "Continue to Checkout" button is enabled<br>**And** clicking it navigates to checkout |
| GJ-BOOK-010 | P1 | State persists on page refresh | **Given** guest selected date=2026-01-20, time=10:00, guests=4<br>**When** guest refreshes page<br>**Then** all selections are preserved<br>**And** summary still shows correct values |

### Page Object: `booking.page.ts`

```typescript
export class BookingPage {
  readonly experienceSummary: Locator;
  readonly calendar: Locator;
  readonly timeSlotGrid: Locator;
  readonly guestCountInput: Locator;
  readonly guestIncrement: Locator;
  readonly guestDecrement: Locator;
  readonly priceBreakdown: Locator;
  readonly totalPrice: Locator;
  readonly bookingSummary: Locator;
  readonly continueButton: Locator;
  readonly capacityBadge: Locator;
  readonly loadingSpinner: Locator;

  constructor(private page: Page) {
    this.experienceSummary = page.getByTestId('experience-summary-card');
    this.calendar = page.getByRole('application', { name: /calendar/i });
    this.timeSlotGrid = page.getByTestId('time-slot-grid');
    this.guestCountInput = page.getByTestId('guest-count-display');
    this.guestIncrement = page.getByRole('button', { name: /increase|plus|\+/i });
    this.guestDecrement = page.getByRole('button', { name: /decrease|minus|-/i });
    this.priceBreakdown = page.getByTestId('price-breakdown');
    this.totalPrice = page.getByTestId('total-price');
    this.bookingSummary = page.getByTestId('booking-summary');
    this.continueButton = page.getByRole('button', { name: /continue|checkout/i });
    this.capacityBadge = page.getByTestId('capacity-badge');
    this.loadingSpinner = page.getByTestId('loading-spinner');
  }

  async goto(slug: string) {
    await this.page.goto(`/experiences/${slug}/book`);
    await this.page.waitForLoadState('networkidle');
  }

  async selectDate(day: number) {
    await this.calendar.getByRole('button', { name: String(day) }).click();
    await this.page.waitForSelector('[data-testid="time-slot-grid"]');
  }

  async selectTimeSlot(time: string) {
    await this.timeSlotGrid.getByRole('button', { name: new RegExp(time, 'i') }).click();
  }

  async setGuestCount(count: number) {
    const current = await this.getGuestCount();
    const diff = count - current;
    const button = diff > 0 ? this.guestIncrement : this.guestDecrement;
    for (let i = 0; i < Math.abs(diff); i++) {
      await button.click();
    }
  }

  async getGuestCount(): Promise<number> {
    const text = await this.guestCountInput.textContent();
    return parseInt(text ?? '0', 10);
  }

  async getTotalPrice(): Promise<string> {
    return this.totalPrice.textContent() ?? '';
  }

  async continueToCheckout() {
    await this.continueButton.click();
    await this.page.waitForURL(/\/checkout/);
  }

  async isDateAvailable(day: number): Promise<boolean> {
    const button = this.calendar.getByRole('button', { name: String(day) });
    return button.isEnabled();
  }
}
```

---

## 4. Checkout & Payment Flow

**Route:** `/experiences/[slug]/checkout?date=...&time=...&guests=...`
**File:** `tests/e2e/flows/guest-checkout.spec.ts`

### Test Scenarios

| ID | Priority | Scenario | Given-When-Then |
|----|----------|----------|-----------------|
| GJ-CHK-001 | P0 | Checkout page validates availability | **Given** guest navigates to checkout with valid params<br>**When** page loads<br>**Then** availability check runs<br>**And** "Verifying Availability" shows briefly<br>**And** form displays when verified |
| GJ-CHK-002 | P0 | Checkout form displays all fields | **Given** availability is verified<br>**When** checkout form renders<br>**Then** Name, Email, Phone fields display<br>**And** booking summary sidebar shows<br>**And** Pay button shows total amount |
| GJ-CHK-003 | P0 | Form validation - required fields | **Given** guest is on checkout page<br>**When** guest clicks Pay without filling form<br>**Then** validation errors show for all fields<br>**And** form does not submit |
| GJ-CHK-004 | P0 | Form validation - email format | **Given** guest is on checkout page<br>**When** guest enters "invalid-email" in email field<br>**Then** validation error shows "Invalid email"<br>**And** form does not submit |
| GJ-CHK-005 | P1 | Form validation - phone format | **Given** guest is on checkout page<br>**When** guest enters "123" in phone field<br>**Then** validation error shows phone format message<br>**And** form does not submit |
| GJ-CHK-006 | P0 | Valid form redirects to Stripe | **Given** guest filled valid form data<br>**When** guest clicks Pay button<br>**Then** button shows "Processing..."<br>**And** guest redirects to Stripe Checkout |
| GJ-CHK-007 | P0 | Stripe success returns to confirmation | **Given** guest is on Stripe Checkout<br>**When** guest completes payment with test card<br>**Then** guest redirects to confirmation page<br>**And** booking status is CONFIRMED |
| GJ-CHK-008 | P1 | Stripe cancel returns to checkout | **Given** guest is on Stripe Checkout<br>**When** guest clicks back/cancel<br>**Then** guest returns to checkout page<br>**And** form data is preserved<br>**And** warning message shows |
| GJ-CHK-009 | P0 | Capacity exceeded during checkout | **Given** guest is on checkout<br>**And** another user books last slot<br>**When** background availability check runs<br>**Then** alert shows capacity exceeded<br>**And** link to adjust booking displays |
| GJ-CHK-010 | P1 | Missing URL params shows error | **Given** guest navigates to checkout without params<br>**When** page loads<br>**Then** error message displays<br>**And** link to start booking shows |
| GJ-CHK-011 | P1 | Booking summary matches selections | **Given** guest is on checkout<br>**When** page renders<br>**Then** summary shows correct experience name<br>**And** formatted date matches selection<br>**And** time, guests, price all correct |

### Page Object: `checkout.page.ts`

```typescript
export class CheckoutPage {
  readonly availabilityAlert: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly payButton: Locator;
  readonly bookingSummary: Locator;
  readonly capacityAlert: Locator;
  readonly errorAlert: Locator;
  readonly processingSpinner: Locator;

  constructor(private page: Page) {
    this.availabilityAlert = page.getByText(/verifying availability/i);
    this.nameInput = page.getByLabel(/name/i);
    this.emailInput = page.getByLabel(/email/i);
    this.phoneInput = page.getByLabel(/phone/i);
    this.payButton = page.getByRole('button', { name: /pay/i });
    this.bookingSummary = page.getByTestId('checkout-summary');
    this.capacityAlert = page.getByRole('alert').filter({ hasText: /capacity/i });
    this.errorAlert = page.getByRole('alert').filter({ hasText: /error/i });
    this.processingSpinner = page.getByText(/processing/i);
  }

  async goto(slug: string, params: { date: string; time: string; guests: number }) {
    const url = `/experiences/${slug}/checkout?date=${params.date}&time=${params.time}&guests=${params.guests}`;
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  async fillForm(data: { name: string; email: string; phone: string }) {
    await this.nameInput.fill(data.name);
    await this.emailInput.fill(data.email);
    await this.phoneInput.fill(data.phone);
  }

  async submitPayment() {
    await this.payButton.click();
  }

  async waitForStripeRedirect() {
    await this.page.waitForURL(/checkout\.stripe\.com/);
  }

  async getValidationError(field: 'name' | 'email' | 'phone'): Promise<string | null> {
    const input = field === 'name' ? this.nameInput
                : field === 'email' ? this.emailInput
                : this.phoneInput;
    const errorId = await input.getAttribute('aria-describedby');
    if (!errorId) return null;
    return this.page.locator(`#${errorId}`).textContent();
  }

  async isPayButtonEnabled(): Promise<boolean> {
    return this.payButton.isEnabled();
  }
}
```

### Stripe Test Helper: `utils/stripe-mock.ts`

```typescript
export async function completeStripeCheckout(page: Page, card: 'success' | 'decline' = 'success') {
  // Wait for Stripe checkout to load
  await page.waitForURL(/checkout\.stripe\.com/);

  // Fill test card details
  const cardNumber = card === 'success' ? '4242424242424242' : '4000000000000002';

  await page.getByLabel(/card number/i).fill(cardNumber);
  await page.getByLabel(/expiry/i).fill('12/30');
  await page.getByLabel(/cvc/i).fill('123');
  await page.getByLabel(/name on card/i).fill('Test User');

  // Submit payment
  await page.getByRole('button', { name: /pay/i }).click();

  // Wait for redirect back to app
  await page.waitForURL(/\/booking\/.*\/confirmation/);
}

export async function cancelStripeCheckout(page: Page) {
  await page.waitForURL(/checkout\.stripe\.com/);
  await page.getByRole('link', { name: /back/i }).click();
}
```

---

## 5. Confirmation Flow

**Route:** `/booking/[id]/confirmation`
**File:** `tests/e2e/flows/guest-checkout.spec.ts`

### Test Scenarios

| ID | Priority | Scenario | Given-When-Then |
|----|----------|----------|-----------------|
| GJ-CONF-001 | P0 | Confirmation page displays after payment | **Given** guest completed Stripe payment<br>**When** redirected to confirmation<br>**Then** success icon displays (green check)<br>**And** "Booking Confirmed" status shows |
| GJ-CONF-002 | P0 | Booking reference displays | **Given** guest is on confirmation page<br>**When** page renders<br>**Then** booking reference shows (EC-XXXXXXXX format)<br>**And** reference is in large monospace font |
| GJ-CONF-003 | P0 | Booking details are correct | **Given** guest booked for Jan 20, 10:00 AM, 4 guests<br>**When** confirmation displays<br>**Then** date shows "Monday, January 20, 2026"<br>**And** time shows "10:00 AM"<br>**And** guests shows "4 guests"<br>**And** total matches paid amount |
| GJ-CONF-004 | P1 | Winery contact info displays | **Given** guest is on confirmation page<br>**When** page renders<br>**Then** winery name displays<br>**And** address with Google Maps link shows<br>**And** phone number is clickable<br>**And** email is clickable |
| GJ-CONF-005 | P1 | Add to Calendar works | **Given** guest is on confirmation page<br>**When** guest clicks "Add to Calendar"<br>**Then** calendar file downloads<br>**And** file contains correct event details |
| GJ-CONF-006 | P2 | Navigation links work | **Given** guest is on confirmation page<br>**When** guest clicks "View Experience"<br>**Then** navigates to experience detail page<br>**When** guest clicks "Browse More"<br>**Then** navigates to home page |

### Page Object: `confirmation.page.ts`

```typescript
export class ConfirmationPage {
  readonly statusIcon: Locator;
  readonly statusBadge: Locator;
  readonly bookingReference: Locator;
  readonly experienceTitle: Locator;
  readonly bookingDate: Locator;
  readonly bookingTime: Locator;
  readonly guestCount: Locator;
  readonly totalPaid: Locator;
  readonly wineryName: Locator;
  readonly wineryAddress: Locator;
  readonly wineryPhone: Locator;
  readonly wineryEmail: Locator;
  readonly addToCalendarButton: Locator;
  readonly viewExperienceLink: Locator;
  readonly browseMoreLink: Locator;
  readonly cancellationPolicy: Locator;

  constructor(private page: Page) {
    this.statusIcon = page.getByTestId('status-icon');
    this.statusBadge = page.getByTestId('status-badge');
    this.bookingReference = page.getByTestId('booking-reference');
    this.experienceTitle = page.getByTestId('experience-title');
    this.bookingDate = page.getByTestId('booking-date');
    this.bookingTime = page.getByTestId('booking-time');
    this.guestCount = page.getByTestId('guest-count');
    this.totalPaid = page.getByTestId('total-paid');
    this.wineryName = page.getByTestId('winery-name');
    this.wineryAddress = page.getByTestId('winery-address');
    this.wineryPhone = page.getByRole('link', { name: /phone|tel/i });
    this.wineryEmail = page.getByRole('link', { name: /@/i });
    this.addToCalendarButton = page.getByRole('button', { name: /add to calendar/i });
    this.viewExperienceLink = page.getByRole('link', { name: /view experience/i });
    this.browseMoreLink = page.getByRole('link', { name: /browse more/i });
    this.cancellationPolicy = page.getByTestId('cancellation-policy');
  }

  async getBookingReference(): Promise<string> {
    return this.bookingReference.textContent() ?? '';
  }

  async getBookingDetails(): Promise<{
    date: string;
    time: string;
    guests: string;
    total: string;
  }> {
    return {
      date: await this.bookingDate.textContent() ?? '',
      time: await this.bookingTime.textContent() ?? '',
      guests: await this.guestCount.textContent() ?? '',
      total: await this.totalPaid.textContent() ?? '',
    };
  }

  async isConfirmed(): Promise<boolean> {
    const badge = await this.statusBadge.textContent();
    return badge?.toLowerCase().includes('confirmed') ?? false;
  }
}
```

---

## 6. Cancellation Flow

**Route:** `/booking/[id]?token=[accessToken]`
**File:** `tests/e2e/flows/guest-cancellation.spec.ts`

### Test Scenarios

| ID | Priority | Scenario | Given-When-Then |
|----|----------|----------|-----------------|
| GJ-CANC-001 | P0 | Cancel button opens modal | **Given** guest has confirmed booking<br>**And** guest is on booking detail page<br>**When** guest clicks "Cancel Booking"<br>**Then** cancellation modal opens<br>**And** policy information displays |
| GJ-CANC-002 | P0 | Refund eligibility shows correctly (eligible) | **Given** booking is >24 hours away<br>**When** cancellation modal opens<br>**Then** green "Eligible for refund" section shows<br>**And** refund amount displays |
| GJ-CANC-003 | P0 | Refund eligibility shows correctly (not eligible) | **Given** booking is <24 hours away<br>**When** cancellation modal opens<br>**Then** amber "No refund" section shows<br>**And** time remaining displays |
| GJ-CANC-004 | P0 | Cancellation requires confirmation checkbox | **Given** cancellation modal is open<br>**When** guest tries to cancel without checkbox<br>**Then** cancel button is disabled<br>**When** guest checks confirmation checkbox<br>**Then** cancel button enables |
| GJ-CANC-005 | P0 | Successful cancellation updates status | **Given** guest confirmed cancellation<br>**When** guest clicks Cancel button<br>**Then** modal closes<br>**And** booking status updates to "Cancelled"<br>**And** success toast notification shows |
| GJ-CANC-006 | P1 | Cancelled booking cannot be cancelled again | **Given** booking is already cancelled<br>**When** guest views booking detail<br>**Then** "Cancel Booking" button does not display<br>**And** status shows "Cancelled" |

### Page Object: `booking-management.page.ts`

```typescript
export class BookingManagementPage {
  readonly statusBadge: Locator;
  readonly cancelButton: Locator;
  readonly cancellationModal: Locator;
  readonly refundEligibleSection: Locator;
  readonly noRefundSection: Locator;
  readonly refundAmount: Locator;
  readonly confirmCheckbox: Locator;
  readonly confirmCancelButton: Locator;
  readonly closeModalButton: Locator;

  constructor(private page: Page) {
    this.statusBadge = page.getByTestId('booking-status');
    this.cancelButton = page.getByRole('button', { name: /cancel booking/i });
    this.cancellationModal = page.getByRole('dialog', { name: /cancel/i });
    this.refundEligibleSection = page.getByTestId('refund-eligible');
    this.noRefundSection = page.getByTestId('no-refund');
    this.refundAmount = page.getByTestId('refund-amount');
    this.confirmCheckbox = page.getByRole('checkbox', { name: /understand/i });
    this.confirmCancelButton = this.cancellationModal.getByRole('button', { name: /cancel/i });
    this.closeModalButton = page.getByRole('button', { name: /close/i });
  }

  async goto(bookingId: string, token: string) {
    await this.page.goto(`/booking/${bookingId}?token=${token}`);
    await this.page.waitForLoadState('networkidle');
  }

  async openCancellationModal() {
    await this.cancelButton.click();
    await this.cancellationModal.waitFor({ state: 'visible' });
  }

  async confirmCancellation() {
    await this.confirmCheckbox.check();
    await this.confirmCancelButton.click();
    await this.cancellationModal.waitFor({ state: 'hidden' });
  }

  async isRefundEligible(): Promise<boolean> {
    return this.refundEligibleSection.isVisible();
  }

  async getBookingStatus(): Promise<string> {
    return this.statusBadge.textContent() ?? '';
  }
}
```

---

## Test Data Requirements

### Fixtures Needed

```typescript
// tests/e2e/fixtures/test-data.fixture.ts

export interface TestWinery {
  id: string;
  name: string;
  slug: string;
  stripeConnected: boolean;
}

export interface TestExperience {
  id: string;
  slug: string;
  title: string;
  pricePerPerson: number; // in cents
  minCapacity: number;
  maxCapacity: number;
  durationMinutes: number;
  availabilitySlots: Array<{
    dayOfWeek: number; // 0-6
    startTime: string; // HH:mm
    endTime: string;
  }>;
}

export interface TestBooking {
  id: string;
  reference: string;
  accessToken: string;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED_BY_CLIENT';
  date: string;
  timeSlot: string;
  guestCount: number;
}

export const testData = {
  // Winery with Stripe connected
  activeWinery: {
    id: 'test-winery-1',
    name: 'Test Domaine',
    slug: 'test-domaine',
    stripeConnected: true,
  },

  // Winery without Stripe
  inactiveWinery: {
    id: 'test-winery-2',
    name: 'Inactive Winery',
    slug: 'inactive-winery',
    stripeConnected: false,
  },

  // Bookable experience
  bookableExperience: {
    id: 'test-exp-1',
    slug: 'wine-tasting-test',
    title: 'Wine Tasting Experience',
    pricePerPerson: 5000, // 50 CHF
    minCapacity: 2,
    maxCapacity: 10,
    durationMinutes: 120,
    availabilitySlots: [
      { dayOfWeek: 1, startTime: '10:00', endTime: '18:00' }, // Monday
      { dayOfWeek: 2, startTime: '10:00', endTime: '18:00' }, // Tuesday
      { dayOfWeek: 3, startTime: '10:00', endTime: '18:00' }, // Wednesday
      { dayOfWeek: 4, startTime: '10:00', endTime: '18:00' }, // Thursday
      { dayOfWeek: 5, startTime: '10:00', endTime: '18:00' }, // Friday
    ],
  },
};
```

---

## Execution Strategy

### CI Pipeline Integration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.57.0-jammy

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: encave_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma db push

      - name: Seed test data
        run: npm run db:seed:test
        env:
          DATABASE_URL: postgresql://test:test@postgres:5432/encave_test

      - name: Run E2E tests
        run: npx playwright test --project=chromium
        env:
          DATABASE_URL: postgresql://test:test@postgres:5432/encave_test
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
          NEXTAUTH_SECRET: test-secret

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### Recommended Execution Order

1. **Smoke Tests (P0)** — Run on every PR
   - GJ-DISC-001, GJ-EXP-001, GJ-EXP-002
   - GJ-BOOK-001 through GJ-BOOK-005, GJ-BOOK-009
   - GJ-CHK-001 through GJ-CHK-003, GJ-CHK-006, GJ-CHK-007, GJ-CHK-009
   - GJ-CONF-001 through GJ-CONF-003
   - GJ-CANC-001 through GJ-CANC-005

2. **Full E2E Suite (P0 + P1)** — Run nightly or on main

3. **Extended Suite (All)** — Run weekly or before release

---

## Quality Checklist

- [x] All 6 guest journey flows covered
- [x] P0 scenarios cover revenue-critical paths
- [x] Page Object Models defined for maintainability
- [x] Test data fixtures specified
- [x] Stripe integration handled with test mode
- [x] CI pipeline configuration provided
- [x] Given-When-Then format for clarity
- [x] 47 total scenarios with priority distribution

---

## Implementation Notes

### Prerequisites

1. **Add data-testid attributes** to components:
   - `ExperienceCard`: `data-testid="experience-card"`
   - `BookingSummary`: `data-testid="booking-summary"`
   - `PriceCalculator`: `data-testid="total-price"`, `data-testid="price-breakdown"`
   - All key interactive elements

2. **Create test database seed script** (`npm run db:seed:test`)

3. **Configure Stripe test mode** with test API keys

4. **Add Playwright to CI** with proper service containers

### Estimated Implementation

| Component | Files |
|-----------|-------|
| Page Objects | 6 files |
| Test Specs | 4 files |
| Fixtures | 3 files |
| Utilities | 2 files |
| CI Config | 1 file |
| **Total** | **16 files** |
