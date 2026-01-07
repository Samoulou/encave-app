# 8. Epic 3: Booking & Payments

## Epic Goal

Implement the complete reservation flow with Stripe Connect integration - delivering the core transactional value of the marketplace.

**Value delivered:** A visitor can book and pay for a wine experience; money flows through the platform with automatic commission split.

---

## Story 3.1: Stripe Connect Winemaker Onboarding

**As a** verified winemaker,
**I want** to connect my bank account to receive payments,
**so that** I get paid when visitors book my experiences.

**Acceptance Criteria:**

1. Prisma schema extended: `Winery` model adds `stripeAccountId`, `stripeOnboardingComplete`, `stripeDetailsSubmitted` fields
2. Stripe Connect configured in Express account mode (platform handles most compliance)
3. "Setup Payments" CTA on winemaker dashboard when Stripe not connected
4. Clicking CTA creates Stripe Connect account and redirects to Stripe onboarding
5. Stripe onboarding return URL (`/dashboard/stripe/callback`) handles success/failure
6. On successful onboarding, `stripeOnboardingComplete` set to true
7. Dashboard shows payment status: "Not connected", "Pending verification", "Ready to accept payments"
8. Winemaker can access Stripe Express dashboard link for payout settings
9. Experiences cannot be published unless Stripe account is fully onboarded
10. Warning banner shown if Stripe account has issues (requires attention)
11. Webhook endpoint (`/api/webhooks/stripe/connect`) handles `account.updated` events
12. Platform commission rate stored in environment variable (default: 12%)

**Prerequisites:** Epic 2 complete

---

## Story 3.2: Booking Selection Flow

**As a** visitor,
**I want** to select a date, time, and group size for an experience,
**so that** I can proceed to book it.

**Acceptance Criteria:**

1. Prisma schema extended with `Booking` model: id, visitorEmail, visitorName, visitorPhone, experienceId, wineryId, date, timeSlot, guestCount, totalPrice, platformFee, wineryPayout, status, stripePaymentIntentId, createdAt
2. Booking status enum: `PENDING_PAYMENT`, `CONFIRMED`, `CANCELLED_BY_CLIENT`, `CANCELLED_BY_WINERY`, `COMPLETED`, `NO_SHOW`
3. "Book Now" button on experience detail page (enabled when Stripe connected)
4. Booking modal/page opens with:
   - Calendar date picker (only shows dates matching availability pattern)
   - Time slot selector (shows available slots for selected date)
   - Guest count input (constrained by min/max capacity)
5. Unavailable dates grayed out in calendar (past dates, days without availability)
6. Real-time capacity check: if slot already has bookings, remaining capacity shown
7. Price calculation displayed: `price × guests = total` (e.g., "CHF 45 × 4 guests = CHF 180")
8. "Continue to Payment" button disabled until all selections valid
9. Selection summary shown before proceeding
10. Booking data stored in session/URL state (survives page refresh)
11. Mobile-friendly date/time selection interface
12. 15-minute reservation hold once "Continue to Payment" clicked (optional for MVP)

**Prerequisites:** Story 3.1

---

## Story 3.3: Checkout & Payment Processing

**As a** visitor,
**I want** to enter my details and pay for my booking,
**so that** my reservation is confirmed.

**Acceptance Criteria:**

1. Checkout page (`/checkout`) displays booking summary (experience, date, time, guests, total)
2. Guest checkout form: name, email, phone number (no account required)
3. If user logged in, form pre-populated with account details
4. Form validation: valid email format, Swiss/international phone format accepted
5. "Pay CHF X" button initiates Stripe Checkout Session
6. Stripe Checkout configured with:
   - Line item showing experience name, quantity (guests), unit price
   - Platform fee as application_fee_amount (commission to EnCave)
   - Destination charge to winemaker's connected account
7. Successful payment redirects to confirmation page (`/booking/[id]/confirmation`)
8. Failed/cancelled payment redirects to checkout with error message
9. Webhook endpoint (`/api/webhooks/stripe/checkout`) handles `checkout.session.completed`
10. On webhook receipt, booking status updated to `CONFIRMED`
11. Idempotency handling prevents duplicate bookings from webhook retries
12. Payment timeout after 30 minutes cancels pending booking

**Prerequisites:** Story 3.2

---

## Story 3.4: Booking Confirmation & Notifications

**As a** visitor and winemaker,
**I want** to receive confirmation of a booking,
**so that** we both have the details needed for the experience.

**Acceptance Criteria:**

1. Confirmation page (`/booking/[id]/confirmation`) displays:
   - Success message with booking reference number
   - Experience details (title, winery, date, time, guests)
   - Location with address and map link (Google Maps directions)
   - Cancellation policy summary
   - "Add to Calendar" buttons (Google Calendar, iCal download)
2. Booking reference format: `ENC-XXXXXX` (6 alphanumeric characters)
3. Client confirmation email sent immediately containing:
   - All booking details
   - Winery contact information
   - What to expect / preparation tips
   - Cancellation link with policy reminder
   - Calendar attachment (.ics file)
4. Winemaker notification email sent containing:
   - New booking alert
   - Client name, email, phone
   - Date, time, guest count
   - Payout amount (after commission)
   - Link to booking in dashboard
5. Emails styled with EnCave branding (React Email templates)
6. Email delivery tracked (sent status logged)
7. Booking accessible via email link without login (`/booking/[id]?token=[secure-token]`)
8. Confirmation page shareable (for group organizers)
9. Error handling if email delivery fails (retry queue or admin alert)
10. Client can request confirmation email resend

**Prerequisites:** Story 3.3

---

## Story 3.5: Booking Cancellation & Refunds

**As a** visitor,
**I want** to cancel my booking and receive a refund if eligible,
**so that** I'm not charged for experiences I cannot attend.

**Acceptance Criteria:**

1. Cancellation policy enforced: >24h before = full refund, <24h = no refund
2. "Cancel Booking" button on booking detail page (client view)
3. Cancellation modal shows:
   - Policy explanation with countdown to 24h deadline
   - Refund amount (full or zero based on policy)
   - Confirmation checkbox ("I understand this action cannot be undone")
4. On cancellation >24h: Stripe refund issued automatically, booking status → `CANCELLED_BY_CLIENT`
5. On cancellation <24h: No refund, booking status → `CANCELLED_BY_CLIENT`, winemaker still paid
6. Client cancellation confirmation email with refund details (if applicable)
7. Winemaker notification email about cancellation
8. Cancelled bookings freed up capacity for new bookings
9. Booking history shows cancelled bookings with status badge
10. Refund processing via Stripe Refund API (application fee also refunded proportionally)
11. Edge case: cancellation exactly at 24h boundary uses server timestamp
12. Admin can manually process refunds for exceptions (via Stripe dashboard for MVP)

**Prerequisites:** Story 3.4

---
