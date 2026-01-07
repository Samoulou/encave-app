# 9. Epic 4: Operations & Launch Readiness

## Epic Goal

Complete winemaker dashboard, notification system, and bilingual support - delivering a production-ready two-sided marketplace.

**Value delivered:** Winemakers can manage their operations autonomously; the platform runs smoothly in French and German.

---

## Story 4.1: Winemaker Bookings Dashboard

**As a** winemaker,
**I want** to see all my reservations in one place,
**so that** I can prepare for upcoming visits and track my activity.

**Acceptance Criteria:**

1. Bookings dashboard page (`/dashboard/bookings`) as default winemaker landing page
2. Summary cards at top: "Today's Bookings", "This Week", "This Month", "Total Guests"
3. Bookings list with columns: date, time, experience name, client name, guests, status, amount
4. Status badges: Confirmed (green), Completed (blue), Cancelled (gray), No-Show (red)
5. Filter options: by status, by experience, by date range
6. Search by client name or booking reference
7. Sort by: date (default: upcoming first), amount, guest count
8. Click row to expand booking details inline (client contact info, notes)
9. Quick actions: "Mark as Completed", "Mark as No-Show" (for past bookings)
10. "View Client" action shows: email, phone, booking history with winery
11. Export bookings to CSV (filtered results)
12. Empty state for new winemakers: "No bookings yet - share your experiences to get started!"

**Prerequisites:** Epic 3 complete

---

## Story 4.2: Winemaker Calendar View

**As a** winemaker,
**I want** to see my bookings on a calendar,
**so that** I can visualize my schedule at a glance.

**Acceptance Criteria:**

1. Calendar view toggle on bookings dashboard (`/dashboard/bookings?view=calendar`)
2. Monthly calendar grid showing days with bookings
3. Day cells show: number of bookings, total guests, colored dots by experience type
4. Click on day to see day detail view with all bookings listed
5. Week view option for more detail (time slots visible)
6. Color coding by experience type (consistent with experience badges)
7. Today highlighted with distinct styling
8. Navigation: previous/next month, "Today" button, month/year picker
9. Hover on booking shows tooltip: experience name, time, guests, client name
10. Click booking opens booking detail modal
11. "Block Date" action to mark days as unavailable (updates availability)
12. Calendar syncs with configured availability slots (shows open vs. booked)

**Prerequisites:** Story 4.1

---

## Story 4.3: Earnings & Payout Tracking

**As a** winemaker,
**I want** to track my earnings and payouts,
**so that** I understand my revenue from the platform.

**Acceptance Criteria:**

1. Earnings page (`/dashboard/earnings`) accessible from dashboard navigation
2. Summary cards: "Total Earnings", "This Month", "Pending Payout", "Next Payout Date"
3. Earnings chart: monthly bar chart showing last 6 months of revenue
4. Transaction list showing each booking: date, experience, guests, gross amount, platform fee, net payout, status
5. Transaction status: "Paid", "Pending", "Refunded"
6. Filter by: month, experience, status
7. Breakdown tooltip: "Gross: CHF 180 - Platform Fee (12%): CHF 21.60 = Your Payout: CHF 158.40"
8. "View in Stripe" link opens Stripe Express dashboard (payouts, bank details)
9. Payout schedule explanation: "Payouts are processed 7 days after the experience"
10. Year-to-date summary with downloadable statement (PDF)
11. Tax info note: "For tax purposes, please consult your accountant. Full records available in Stripe."
12. Currency always displayed as CHF

**Prerequisites:** Story 4.1

---

## Story 4.4: Automated Email Notifications

**As a** platform user,
**I want** to receive timely email reminders and updates,
**so that** I don't miss important booking information.

**Acceptance Criteria:**

1. **Client reminder email** sent 24 hours before experience:
   - Experience details, date, time, location
   - Winery contact info
   - "Add to Calendar" link
   - Cancellation policy reminder
2. **Client reminder email** sent 2 hours before experience (morning of):
   - Brief reminder with location and time
   - Directions link
3. **Winemaker daily digest** (morning, 7am):
   - Today's bookings summary
   - Tomorrow's bookings preview
   - Only sent if there are upcoming bookings
4. **Post-experience follow-up** to client (24h after):
   - Thank you message
   - "How was your experience?" (link to future review feature placeholder)
   - "Discover more experiences" CTA
5. **Weekly summary** to winemaker (Monday morning):
   - Last week: bookings, guests, earnings
   - This week: upcoming bookings
   - Only sent if any activity
6. Email preferences page (`/dashboard/settings/notifications`) for winemakers:
   - Toggle each notification type on/off
   - Daily digest time preference (morning/evening)
7. Unsubscribe link in all marketing-style emails (follow-up, weekly summary)
8. Transactional emails (confirmations, cancellations) cannot be disabled
9. All emails use consistent EnCave branded templates
10. Email scheduling via background job queue (not blocking request)
11. Failed email delivery logged for admin review
12. Preview email templates in development environment

**Prerequisites:** Stories 4.1, 3.4

---

## Story 4.5: Bilingual Support (French/German)

**As a** visitor or winemaker,
**I want** to use the platform in my preferred language,
**so that** I can understand all content easily.

**Acceptance Criteria:**

1. next-intl configured with French (default) and German locales
2. Language switcher in header (FR | DE) visible on all pages
3. URL structure: `/fr/experiences`, `/de/experiences` (locale prefix)
4. All UI strings externalized to translation files (`messages/fr.json`, `messages/de.json`)
5. Translated content includes:
   - Navigation and buttons
   - Form labels and validation messages
   - Error messages and empty states
   - Email templates (both languages)
   - Date/time formatting (locale-aware)
6. Currency formatting: "CHF 45.00" (consistent, no translation needed)
7. User language preference stored in cookie (persists across sessions)
8. Logged-in users: language preference saved to profile
9. Browser language detection for first-time visitors
10. Winemaker content (experience descriptions) remains in original language (no auto-translation)
11. Admin interface remains French-only for MVP
12. SEO: hreflang tags for language alternates, localized meta descriptions

**Prerequisites:** All previous stories

---

## Story 4.6: Launch Polish & Error Handling

**As a** visitor,
**I want** a polished, error-free experience,
**so that** I trust the platform with my booking and payment.

**Acceptance Criteria:**

1. Custom 404 page with: friendly message, search bar, popular experiences links
2. Custom 500 error page with: apology message, "Try again" button, support contact
3. Global error boundary catches React errors, displays fallback UI
4. Loading states for all async operations (skeletons, spinners)
5. Optimistic UI updates where appropriate (e.g., adding to calendar)
6. Form submission buttons show loading state, prevent double-submit
7. Toast notifications for success/error feedback (consistent styling)
8. Image lazy loading with blur placeholder (Next.js Image optimization)
9. Favicon and PWA manifest configured (installable on mobile)
10. OpenGraph and Twitter meta tags on all public pages
11. robots.txt and sitemap.xml generated (dynamic for experiences, wineries)
12. Core Web Vitals targets: LCP < 2.5s, FID < 100ms, CLS < 0.1
13. Sentry error tracking configured (captures frontend and API errors)
14. Basic analytics setup (Vercel Analytics or Plausible)
15. Legal pages created: Privacy Policy, Terms of Service, Cancellation Policy (`/legal/*`)

**Prerequisites:** All previous stories

---
