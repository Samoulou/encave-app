# EnCave Product Requirements Document (PRD)

> _"En Valais on fait du vin de classe mondial et on doit pouvoir le montrer!"_

---

## Change Log

| Date       | Version | Description                    | Author    |
| ---------- | ------- | ------------------------------ | --------- |
| 2026-01-07 | 1.0     | Initial PRD from Project Brief | John (PM) |

---

## 1. Goals and Background Context

### 1.1 Goals

- Provide a centralized platform for discovering and booking wine experiences in Valais (then Switzerland/Europe)
- Enable clients to search, compare, and book wine tastings in just a few clicks
- Reduce administrative burden for winemakers (encaveurs) through automated booking management
- Achieve product-market fit with 10+ active winemakers and 50+ bookings within 3 months
- Establish EnCave as the reference platform for Swiss wine tourism

### 1.2 Background Context

The Valais region produces world-class wines, yet wine tourism remains underexploited due to fragmented information and archaic booking processes. Winemakers lack online visibility and spend excessive time on administrative tasks (phone calls, emails, no-shows), while tourists struggle to find and compare experiences. No dedicated platform exists in Switzerland for wine experiences - generic platforms like Viator poorly serve this niche. EnCave addresses this gap as a two-sided marketplace connecting wine enthusiasts with local winemakers, starting in Valais with planned expansion across Switzerland and Europe.

---

## 2. Requirements

### 2.1 Functional Requirements

**Client-Facing:**

- **FR1:** Users can search for wine experiences by location (region/commune), date range, and experience type (tasting, cellar visit, workshop)
- **FR2:** Search results display as a filtered list showing experience name, price, photo, average rating, and availability
- **FR3:** Users can view a detailed experience page with description, winery info, wines offered, location map, capacity, and cancellation policy
- **FR4:** Users can select a date/time slot and number of participants to initiate a booking
- **FR5:** Users can complete payment via Stripe with 100% prepayment required
- **FR6:** Users receive a confirmation email with booking summary, location details, and cancellation conditions
- **FR7:** Users can cancel a booking (refund policy: >24h = full refund, <24h = non-refundable)

**Encaveur-Facing:**

- **FR8:** Winemakers can register via a simplified form with manual verification by platform admin
- **FR9:** Winemakers can create experiences with: type, description, photos, price, schedule/availability, min/max capacity
- **FR10:** Winemakers can view a dashboard listing all upcoming reservations with client details
- **FR11:** Winemakers receive email notifications for each new booking, modification, or cancellation
- **FR12:** Winemakers can manage their availability calendar (block dates, set recurring schedules)

**Platform/Admin:**

- **FR13:** Platform processes payments via Stripe Connect with split payment (platform commission + winemaker payout)
- **FR14:** Platform automatically disburses winemaker payments after experience completion
- **FR15:** Platform admin can verify/approve new winemaker registrations
- **FR16:** Platform supports bilingual content (French/German) with manual translations for MVP

### 2.2 Non-Functional Requirements

- **NFR1:** Time to First Contentful Paint < 2 seconds on 3G connection
- **NFR2:** Search results returned in < 500ms
- **NFR3:** All traffic served over HTTPS
- **NFR4:** Payment processing delegated to Stripe (PCI-DSS compliance)
- **NFR5:** Personal data handling compliant with GDPR/Swiss data protection
- **NFR6:** Support modern browsers: Chrome, Safari, Firefox, Edge (last 2 versions)
- **NFR7:** Mobile-first responsive design (works on devices 320px+)
- **NFR8:** System availability target: 99.5% uptime
- **NFR9:** Booking confirmation emails sent within 60 seconds of payment completion

---

## 3. User Interface Design Goals

### 3.1 Overall UX Vision

EnCave should feel like a **premium yet approachable** wine discovery platform - sophisticated enough to reflect the quality of Valais wines, but simple enough that a tourist can book an experience in under 2 minutes. The experience should evoke the warmth of a personal invitation from a winemaker, not a sterile transaction.

**Design pillars:**

- **Simplicity:** Minimal steps from discovery to booking (3-click booking)
- **Trust:** Clear pricing, transparent policies, verified winemakers
- **Local authenticity:** Visual identity rooted in Valais terroir and wine culture
- **Dual-persona clarity:** Distinct but coherent experiences for clients vs. winemakers

### 3.2 Key Interaction Paradigms

| Paradigm                        | Description                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| **Search-first discovery**      | Homepage prominently features search (date, location, type) - inspired by Booking.com |
| **Card-based browsing**         | Experiences displayed as visual cards with photo, price, rating - scannable on mobile |
| **Linear booking flow**         | Step-by-step: Select → Configure → Pay → Confirm (no account required to browse)      |
| **Dashboard for professionals** | Winemakers get a functional admin panel - utility over aesthetics                     |
| **Progressive disclosure**      | Show essential info first, details on demand (expandable sections)                    |

### 3.3 Core Screens and Views

**Client Journey:**

1. **Homepage** - Search bar, featured experiences, regional highlights
2. **Search Results** - Filterable list/map view of experiences
3. **Experience Detail** - Full info, photos, calendar picker, booking CTA
4. **Booking Flow** - Date/participants selection → Contact info → Payment
5. **Confirmation** - Success screen + email preview
6. **My Bookings** - List of upcoming/past reservations (requires account)

**Encaveur Journey:** 7. **Registration/Onboarding** - Multi-step form with guidance 8. **Dashboard Home** - Upcoming bookings, quick stats, alerts 9. **Experience Management** - Create/edit experiences, set availability 10. **Reservation Detail** - Client info, status, actions (confirm/cancel) 11. **Payout History** - Earnings overview, transaction list

### 3.4 Accessibility

**Target: WCAG AA compliance**

- Sufficient color contrast (4.5:1 minimum)
- Keyboard navigable
- Screen reader compatible
- Form labels and error messages accessible

### 3.5 Branding

**Known elements:**

- Name: **EnCave** (play on "en cave" = in the cellar)
- Tagline: _"En Valais on fait du vin de classe mondial et on doit pouvoir le montrer!"_

**Suggested direction:**

- Color palette: Earthy tones (burgundy, warm gold, slate) evoking wine and mountains
- Typography: Modern serif for headings (elegance), clean sans-serif for body (readability)
- Imagery: Authentic photos of Valais vineyards, cellars, winemakers - no stock photos
- Tone: Warm, inviting, locally-rooted - avoid corporate/generic marketplace feel

### 3.6 Target Devices and Platforms

- **Primary:** Mobile web (tourists browsing on phones)
- **Secondary:** Desktop web (winemakers managing bookings, clients at home)
- **Breakpoints:** 320px (mobile) → 768px (tablet) → 1024px+ (desktop)
- **No native app for MVP**

---

## 4. Technical Assumptions

### 4.1 Repository Structure: Monorepo

Single repository with Next.js full-stack application:

```
encave/
├── src/
│   ├── app/           # Next.js App Router (pages + API)
│   ├── components/    # React components
│   ├── lib/           # Business logic, utilities
│   ├── server/        # Server-only code (DB, services)
│   └── types/         # Shared TypeScript types
├── prisma/            # Database schema & migrations
├── public/            # Static assets
├── docs/
└── tests/
```

### 4.2 Service Architecture: Next.js Full-Stack Monolith

| Layer         | Technology                             |
| ------------- | -------------------------------------- |
| Rendering     | React Server Components (RSC)          |
| Mutations     | Server Actions + API Routes            |
| Data fetching | Direct DB queries in Server Components |
| External APIs | API Routes (Stripe webhooks)           |

### 4.3 Tech Stack

| Layer                | Choice                    | Rationale                                                  |
| -------------------- | ------------------------- | ---------------------------------------------------------- |
| **Framework**        | Next.js 14+ (App Router)  | Full-stack React; SSR for SEO; excellent DX                |
| **Language**         | TypeScript                | Type safety end-to-end                                     |
| **Database**         | PostgreSQL                | Robust, free, excellent support                            |
| **ORM**              | Prisma                    | Type-safe queries; migrations; excellent with Next.js      |
| **Auth**             | NextAuth.js (Auth.js)     | Standard Next.js; providers multiples; session JWT         |
| **Hosting**          | Vercel                    | Native Next.js deployment; edge functions; preview deploys |
| **Database Hosting** | Neon or Supabase          | PostgreSQL serverless; free tier; Vercel integration       |
| **Payments**         | Stripe Connect            | Marketplace payments; Swiss support; handles PCI           |
| **Email**            | Resend                    | Modern API; React Email support                            |
| **File Storage**     | Vercel Blob or Cloudinary | Images; CDN integrated                                     |
| **Styling**          | Tailwind CSS              | Rapid UI development                                       |
| **UI Components**    | shadcn/ui                 | Accessible; customizable; no lock-in                       |

### 4.4 Testing Requirements

| Layer           | Tool                   |
| --------------- | ---------------------- |
| Unit tests      | Vitest                 |
| Component tests | React Testing Library  |
| Integration     | Vitest + test database |
| E2E (Phase 2)   | Playwright             |

**Coverage targets:**

- Business logic: 80%+ coverage
- API endpoints: Integration tests for happy paths + key error cases

### 4.5 Additional Technical Assumptions

- **Auth flow:** Email/password + Google OAuth via NextAuth.js
- **API Style:** Server Actions for mutations, API Routes for webhooks
- **Validation:** Zod (schema validation shared client/server)
- **Forms:** React Hook Form + Zod
- **State Management:** React Context + URL state (nuqs); no Redux
- **Logging:** Vercel Logs + Sentry for error tracking
- **CI/CD:** GitHub Actions → Vercel (auto-deploy on push)
- **i18n:** next-intl for FR/DE
- **Search:** PostgreSQL full-text via Prisma

**Stripe Connect:**

- Account type: Express (simplest onboarding)
- Payment flow: Direct charges with application fee
- Payout schedule: T+7 days after experience completion
- Platform commission: 12% (configurable)

---

## 5. Epic List

| #          | Epic Title                     | Goal Statement                                                                                                                            |
| ---------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Epic 1** | Foundation & Identity          | Establish project infrastructure, authentication system, and winemaker onboarding - delivering a public page listing verified winemakers. |
| **Epic 2** | Experience Catalog & Discovery | Enable winemakers to create experiences and visitors to search/browse them - delivering a functional discovery platform.                  |
| **Epic 3** | Booking & Payments             | Implement the complete reservation flow with Stripe Connect integration - delivering the core transactional value.                        |
| **Epic 4** | Operations & Launch Readiness  | Complete winemaker dashboard, notification system, and bilingual support - delivering a production-ready marketplace.                     |

### Epic Flow

```
Epic 1: Foundation          Epic 2: Catalog           Epic 3: Booking          Epic 4: Operations
┌─────────────────┐        ┌─────────────────┐       ┌─────────────────┐      ┌─────────────────┐
│ • Next.js setup │        │ • Create exp.   │       │ • Booking flow  │      │ • Dashboard     │
│ • Auth system   │───────▶│ • Search/filter │──────▶│ • Stripe Connect│─────▶│ • Notifications │
│ • Winery profile│        │ • Detail page   │       │ • Confirmations │      │ • Calendar mgmt │
│ • Public listing│        │ • Photo upload  │       │ • Cancellations │      │ • i18n FR/DE    │
└─────────────────┘        └─────────────────┘       └─────────────────┘      └─────────────────┘
```

---

## 6. Epic 1: Foundation & Identity

### Epic Goal

Establish project infrastructure, authentication system, and winemaker onboarding - delivering a public page listing verified winemakers as proof of end-to-end functionality.

**Value delivered:** A visitor can browse a directory of verified Valais winemakers; a winemaker can register and await verification.

---

### Story 1.1: Project Foundation & Infrastructure

**As a** developer,
**I want** a fully configured Next.js project with database and deployment pipeline,
**so that** I have a solid foundation to build features upon.

**Acceptance Criteria:**

1. Next.js 14+ project initialized with App Router, TypeScript strict mode, and `src/` directory structure
2. Tailwind CSS configured with a base color palette (burgundy, gold, slate as primaries)
3. shadcn/ui initialized with Button, Input, Card, and Form components
4. PostgreSQL database provisioned (Neon or Supabase) with connection string in environment variables
5. Prisma ORM configured with initial schema containing `User` model (id, email, name, role, createdAt)
6. Environment configuration for development, preview, and production (.env.example documented)
7. GitHub repository created with main branch protection and PR workflow
8. Vercel project connected with automatic deployments on push to main
9. Health check API route (`/api/health`) returns `{ status: "ok", timestamp }` with 200 status
10. Home page displays "EnCave - Coming Soon" with health status indicator
11. ESLint + Prettier configured with consistent code style rules
12. README.md with setup instructions for local development

**Prerequisites:** None

---

### Story 1.2: Authentication System

**As a** user,
**I want** to create an account and log in securely,
**so that** I can access personalized features of the platform.

**Acceptance Criteria:**

1. NextAuth.js (Auth.js) configured with Credentials provider for email/password
2. Prisma schema extended with password hash field and `Account`, `Session` models for NextAuth
3. Password hashing implemented using bcrypt with minimum 10 rounds
4. Login page (`/login`) with email and password fields, validation errors displayed inline
5. Registration page (`/register`) with email, password, confirm password, and name fields
6. Password requirements enforced: minimum 8 characters, at least one number
7. JWT session strategy configured with 7-day expiration
8. Protected route middleware redirects unauthenticated users to `/login`
9. Session accessible in Server Components via `auth()` helper
10. Logout functionality clears session and redirects to home page
11. User role enum created: `CLIENT`, `WINEMAKER`, `ADMIN` (default: `CLIENT`)
12. Auth error messages are user-friendly (no technical jargon)

**Prerequisites:** Story 1.1

---

### Story 1.3: Winemaker Registration Flow

**As a** winemaker,
**I want** to register my winery on the platform,
**so that** I can eventually offer wine experiences to visitors.

**Acceptance Criteria:**

1. Prisma schema extended with `Winery` model: id, name, slug, description, address, commune, phone, email, userId, status, createdAt
2. Winery status enum: `PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`
3. Registration flow extended: after basic signup, winemakers select "I am a winemaker" option
4. Winemaker onboarding form (`/onboarding/winery`) collects: winery name, description (textarea), address, commune (dropdown of Valais communes), contact phone
5. Form validation with Zod schema (name required, description min 50 chars, valid Swiss phone format)
6. On submission, `Winery` record created with status `PENDING`, user role updated to `WINEMAKER`
7. Confirmation page explains verification process and expected timeline
8. User cannot access winemaker features until status is `VERIFIED`
9. Duplicate winery name check with user-friendly error message
10. Winery slug auto-generated from name (URL-safe, unique)

**Prerequisites:** Story 1.2

---

### Story 1.4: Winemaker Profile Management

**As a** verified winemaker,
**I want** to manage my winery's profile and photos,
**so that** visitors see accurate and attractive information.

**Acceptance Criteria:**

1. Winery profile page (`/dashboard/winery/profile`) accessible only to verified winemakers
2. Edit form pre-populated with current winery data
3. Photo upload component supporting JPEG/PNG, max 5MB per image
4. Cover photo field (single image, 16:9 aspect ratio recommended)
5. Gallery photos field (up to 6 images)
6. Images uploaded to Vercel Blob (or Cloudinary) with automatic optimization
7. Image preview shown before and after upload
8. Description field supports basic formatting guidance (plain text for MVP)
9. Changes saved with success toast notification
10. Validation prevents saving incomplete required fields
11. "View public profile" link to preview how visitors will see the winery
12. Last updated timestamp displayed on profile

**Prerequisites:** Story 1.3

---

### Story 1.5: Admin Winemaker Verification

**As a** platform administrator,
**I want** to review and verify pending winemaker registrations,
**so that** only legitimate wineries appear on the platform.

**Acceptance Criteria:**

1. Admin role check middleware for `/admin/*` routes
2. Admin dashboard page (`/admin`) with navigation to verification queue
3. Pending wineries list (`/admin/wineries/pending`) showing: name, commune, registration date, applicant email
4. Winery detail view (`/admin/wineries/[id]`) showing all submitted information
5. "Approve" action sets status to `VERIFIED` and timestamps verification date
6. "Reject" action sets status to `REJECTED` with required reason text field
7. Approved winemakers receive email notification (template: "Your winery has been verified!")
8. Rejected winemakers receive email with rejection reason
9. Filter/sort options: by date, by commune
10. Count badge showing number of pending verifications
11. Verification action logged with admin user ID and timestamp
12. Initial admin user seeded in development database

**Prerequisites:** Story 1.3

---

### Story 1.6: Public Winery Directory

**As a** visitor,
**I want** to browse a list of verified wineries in Valais,
**so that** I can discover winemakers in the region.

**Acceptance Criteria:**

1. Public wineries page (`/wineries`) accessible without authentication
2. Grid layout displaying winery cards (photo, name, commune, short description)
3. Only `VERIFIED` wineries displayed
4. Cards link to individual winery page (`/wineries/[slug]`)
5. Individual winery page shows: cover photo, name, full description, location, contact info
6. Empty state message if no verified wineries yet: "Winemakers coming soon..."
7. Page metadata (title, description) configured for SEO
8. Server-side rendering for optimal SEO and performance
9. Basic commune filter (dropdown) to narrow results
10. Responsive layout: 1 column mobile, 2 columns tablet, 3 columns desktop
11. "Coming soon: Book experiences" teaser on winery detail page
12. Page loads in under 2 seconds (LCP metric)

**Prerequisites:** Story 1.5

---

## 7. Epic 2: Experience Catalog & Discovery

### Epic Goal

Enable winemakers to create experiences and visitors to search/browse them - delivering a functional discovery platform without booking capability.

**Value delivered:** A visitor can discover wine experiences in Valais, filter by preferences, and view full details; a winemaker can publish their offerings.

---

### Story 2.1: Create Experience

**As a** verified winemaker,
**I want** to create wine experiences with details and photos,
**so that** visitors can discover what I offer.

**Acceptance Criteria:**

1. Prisma schema extended with `Experience` model: id, wineryId, title, slug, description, type, duration (minutes), price (CHF), minCapacity, maxCapacity, coverPhoto, status, createdAt, updatedAt
2. Experience type enum: `TASTING`, `CELLAR_VISIT`, `WORKSHOP`, `VINEYARD_TOUR`, `FOOD_PAIRING`
3. Experience status enum: `DRAFT`, `PUBLISHED`, `ARCHIVED`
4. Create experience page (`/dashboard/experiences/new`) accessible to verified winemakers only
5. Form fields: title, type (select), description (rich text area), duration (select: 1h, 1.5h, 2h, 3h, half-day), price in CHF, min/max capacity
6. Form validation with Zod: title required (max 100 chars), description required (min 100 chars), price > 0, minCapacity >= 1, maxCapacity >= minCapacity
7. Cover photo upload (required) with 16:9 aspect ratio guidance
8. Gallery photos upload (optional, up to 8 images)
9. Experience slug auto-generated from title (unique within winery)
10. New experiences created with status `DRAFT`
11. Success redirect to experience management dashboard
12. Form preserves data on validation errors

**Prerequisites:** Epic 1 complete

---

### Story 2.2: Experience Management Dashboard

**As a** winemaker,
**I want** to manage my experiences (edit, publish, archive),
**so that** I can keep my offerings up to date.

**Acceptance Criteria:**

1. Experiences list page (`/dashboard/experiences`) showing all winemaker's experiences
2. List displays: cover photo thumbnail, title, type badge, price, status badge, last updated
3. Status badges color-coded: Draft (gray), Published (green), Archived (amber)
4. "Create New Experience" CTA button prominently displayed
5. Edit action opens edit form (`/dashboard/experiences/[id]/edit`) with pre-populated data
6. "Publish" action available for `DRAFT` experiences, sets status to `PUBLISHED`
7. "Unpublish" action available for `PUBLISHED` experiences, reverts to `DRAFT`
8. "Archive" action available for any status, sets to `ARCHIVED` (soft delete)
9. "Duplicate" action creates a copy in `DRAFT` status
10. Confirmation modal for destructive actions (archive)
11. Empty state with guidance: "Create your first experience to attract visitors"
12. Sort by: newest, oldest, alphabetical, status

**Prerequisites:** Story 2.1

---

### Story 2.3: Experience Availability Configuration

**As a** winemaker,
**I want** to define when my experiences are available,
**so that** visitors know when they can book.

**Acceptance Criteria:**

1. Prisma schema extended with `AvailabilitySlot` model: id, experienceId, dayOfWeek (0-6), startTime, endTime, isActive
2. Availability configuration section on experience edit page
3. Weekly schedule builder UI: select days of week, add time slots per day
4. Time slot picker: start time (dropdown, 30-min increments from 08:00-20:00), end time (auto-calculated from duration or manual override)
5. Multiple time slots per day supported (e.g., 10:00-12:00 and 14:00-16:00)
6. Toggle to enable/disable specific slots without deleting
7. Visual weekly calendar preview showing configured availability
8. Validation: slots cannot overlap on same day
9. "Copy to all days" helper for common schedules
10. Default empty state: "No availability configured - visitors cannot book yet"
11. Warning shown if experience is `PUBLISHED` but has no availability
12. Changes saved independently from other experience fields

**Prerequisites:** Story 2.1

---

### Story 2.4: Public Experience Search

**As a** visitor,
**I want** to search and filter wine experiences in Valais,
**so that** I can find experiences that match my interests.

**Acceptance Criteria:**

1. Public experiences page (`/experiences`) accessible without authentication
2. Only `PUBLISHED` experiences with at least one active availability slot displayed
3. Search bar for text search (searches title, description, winery name)
4. Filter panel with:
   - Experience type (multi-select checkboxes)
   - Commune/location (dropdown with Valais communes)
   - Price range (min/max slider or inputs)
   - Capacity (minimum group size filter)
5. Results displayed as cards: cover photo, title, winery name, commune, price, duration, type badge
6. Sort options: relevance (default), price low-high, price high-low, newest
7. Results count displayed: "12 experiences found"
8. Empty state for no results: "No experiences match your filters. Try adjusting your search."
9. URL query parameters for filters (shareable/bookmarkable search URLs)
10. Server-side filtering for SEO and performance
11. Responsive grid: 1 col mobile, 2 cols tablet, 3 cols desktop
12. Page loads under 2 seconds with 50+ experiences

**Prerequisites:** Stories 2.1, 2.2, 2.3

---

### Story 2.5: Experience Detail Page

**As a** visitor,
**I want** to view full details of a wine experience,
**so that** I can decide if I want to book it.

**Acceptance Criteria:**

1. Experience detail page (`/experiences/[slug]`) with SEO-optimized URL
2. Hero section with cover photo (full width), title, type badge, price prominently displayed
3. Photo gallery component (lightbox for full-screen viewing)
4. Experience details section: full description, duration, capacity (min-max persons)
5. Availability preview showing days/times when experience runs
6. Winery info card: name, commune, cover photo, link to winery page
7. Location section with address and embedded map (Google Maps or OpenStreetMap)
8. "Book This Experience" CTA button (disabled state with tooltip: "Booking coming soon!")
9. Breadcrumb navigation: Home > Experiences > [Experience Title]
10. Related experiences section: 2-3 other experiences from same winery or same type
11. Schema.org structured data for rich search results (Event/Product markup)
12. Social sharing meta tags (Open Graph, Twitter Card) with cover image

**Prerequisites:** Story 2.4

---

## 8. Epic 3: Booking & Payments

### Epic Goal

Implement the complete reservation flow with Stripe Connect integration - delivering the core transactional value of the marketplace.

**Value delivered:** A visitor can book and pay for a wine experience; money flows through the platform with automatic commission split.

---

### Story 3.1: Stripe Connect Winemaker Onboarding

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

### Story 3.2: Booking Selection Flow

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

### Story 3.3: Checkout & Payment Processing

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

### Story 3.4: Booking Confirmation & Notifications

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

### Story 3.5: Booking Cancellation & Refunds

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

## 9. Epic 4: Operations & Launch Readiness

### Epic Goal

Complete winemaker dashboard, notification system, and bilingual support - delivering a production-ready two-sided marketplace.

**Value delivered:** Winemakers can manage their operations autonomously; the platform runs smoothly in French and German.

---

### Story 4.1: Winemaker Bookings Dashboard

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

### Story 4.2: Winemaker Calendar View

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

### Story 4.3: Earnings & Payout Tracking

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

### Story 4.4: Automated Email Notifications

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

### Story 4.5: Bilingual Support (French/German)

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

### Story 4.6: Launch Polish & Error Handling

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

## 10. Checklist Results Report

### Executive Summary

| Metric                         | Assessment |
| ------------------------------ | ---------- |
| **Overall PRD Completeness**   | 92%        |
| **MVP Scope Appropriateness**  | Just Right |
| **Readiness for Architecture** | Ready      |

### Category Analysis

| Category                         | Status  | Critical Issues       |
| -------------------------------- | ------- | --------------------- |
| 1. Problem Definition & Context  | PASS    | None                  |
| 2. MVP Scope Definition          | PASS    | Clear in/out of scope |
| 3. User Experience Requirements  | PARTIAL | No mockups (expected) |
| 4. Functional Requirements       | PASS    | 16 FRs well-defined   |
| 5. Non-Functional Requirements   | PASS    | 9 NFRs with targets   |
| 6. Epic & Story Structure        | PASS    | Logical sequence      |
| 7. Technical Guidance            | PASS    | Clear stack decision  |
| 8. Cross-Functional Requirements | PARTIAL | Data retention TBD    |
| 9. Clarity & Communication       | PASS    | Consistent language   |

### Recommendations

1. **Add:** Data retention policy (suggest 3 years for bookings, GDPR deletion on request)
2. **Architect focus:** Payment flow error handling, webhook reliability
3. **Consider:** Feature flags for gradual rollout
4. **Testing:** Stripe test mode strategy for all environments

### Final Decision

**READY FOR ARCHITECT** - The PRD is comprehensive and provides clear guidance for architectural design.

---

## 11. Next Steps

### UX Expert Prompt

> Review the EnCave PRD (docs/prd.md) and create wireframes/mockups for the core user journeys: client booking flow and winemaker dashboard. Focus on mobile-first responsive design with the premium-yet-approachable brand direction. Deliver clickable prototypes for user testing.

### Architect Prompt

> Review the EnCave PRD (docs/prd.md) and create the technical architecture document. Key areas: Next.js App Router structure, Prisma schema design, Stripe Connect integration patterns, and deployment architecture on Vercel + Neon. Consider the 22-story implementation sequence.

---

_Document generated 2026-01-07 | John, Product Manager_
