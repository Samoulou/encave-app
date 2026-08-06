# Encave Winemaker Dashboard — UX/UI Audit & Fix Plan

**Date:** 2026-02-23
**Branch:** `UX-UI-refactor`
**Scope:** All 5 dashboard sections (Overview, Experiences, Reservations, Revenue, Settings) + Sidebar/Layout
**Files Audited:** ~80 files, ~8,000+ lines

---

## Table of Contents

- [Phase 1: Dead Buttons & Broken Links](#phase-1-dead-buttons--broken-links)
- [Phase 2: Internationalization (i18n)](#phase-2-internationalization-i18n)
- [Phase 3: Accessibility (WCAG 2.1)](#phase-3-accessibility-wcag-21)
- [Phase 4: Error Boundaries & Missing States](#phase-4-error-boundaries--missing-states)
- [Phase 5: Design Token Alignment](#phase-5-design-token-alignment)
- [Phase 6: Navigation & Layout Polish](#phase-6-navigation--layout-polish)
- [Appendix: Full Issue Inventory](#appendix-full-issue-inventory)

---

## Phase 1: Dead Buttons & Broken Links

**Priority:** CRITICAL — Users click and nothing happens
**Estimated files:** 7

### 1.1 Remove or wire dead buttons

| File                                                                    | Line(s) | Element                                            | Action                                                                                        |
| ----------------------------------------------------------------------- | ------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/components/features/earnings/TransactionTable.tsx`                 | 166-167 | "View Details" / "Download Receipt" dropdown items | Wire onClick to open detail modal or remove items until feature is built                      |
| `src/components/features/experience/form-sections/BasicInfoSection.tsx` | 123-153 | Rich text toolbar (Bold, Italic, Underline, List)  | Remove toolbar entirely — textarea has no rich text support, toolbar is misleading            |
| `src/components/features/experience/form-sections/MediaSection.tsx`     | 82-88   | Eye icon "Preview image" button                    | Wire to open image in a lightbox/modal or remove button                                       |
| `src/components/layout/DashboardSidebar.tsx`                            | 160-172 | User profile card (cursor-pointer, no handler)     | Either make it a `<Link>` to `/dashboard/settings` or remove `cursor-pointer` + hover styling |
| `src/components/layout/ClientDashboardSidebar.tsx`                      | 145-157 | User profile card (same issue)                     | Same fix as above — link to `/dashboard/profile` for clients                                  |

### 1.2 Fix broken navigation links

| File                                                                              | Line | Current Target                                      | Fix                                                           |
| --------------------------------------------------------------------------------- | ---- | --------------------------------------------------- | ------------------------------------------------------------- |
| `src/app/[locale]/(protected)/dashboard/bookings/BookingsPageHeader.tsx`          | 24   | `/dashboard/bookings/new` (404)                     | Remove "Add Booking" button or create the route               |
| `src/app/[locale]/(protected)/dashboard/earnings/EarningsTransactionsSection.tsx` | 47   | `/dashboard/earnings/all` (404)                     | Remove "View All" link or create the route                    |
| `src/components/features/earnings/EarningsPageHeader.tsx`                         | 18   | Breadcrumb "Dashboard" is `<span>` with hover style | Convert to `<Link href="/dashboard">` or remove hover styling |

---

## Phase 2: Internationalization (i18n)

**Priority:** CRITICAL — French (default) and German users see English
**Estimated files:** 20+ components, 3 locale files

### 2.1 Fully non-localized components (zero i18n)

These need complete extraction to translation keys + entries in `messages/en.json`, `messages/fr.json`, `messages/de.json`:

| Component                                                          | Strings                              | i18n Namespace               |
| ------------------------------------------------------------------ | ------------------------------------ | ---------------------------- |
| `src/components/features/winery/WineryAccessGuard.tsx`             | 17+                                  | `winery.accessGuard`         |
| `src/components/features/settings/NotificationPreferencesForm.tsx` | 15+                                  | `settings.notifications`     |
| `src/components/features/winery/StripeCallbackResult.tsx`          | 10+                                  | `stripe.callback`            |
| `src/components/features/winery/PaymentStatus.tsx`                 | 5+                                   | `stripe.paymentStatus`       |
| `src/components/features/winery/StripeOnboarding.tsx`              | 4+                                   | `stripe.onboarding`          |
| `src/components/features/winery/StripeWarningBanner.tsx`           | 3+                                   | `stripe.warning`             |
| `src/components/features/earnings/EarningsChart.tsx`               | 4                                    | `earnings.chart`             |
| `src/components/features/earnings/YearToDateSummary.tsx`           | 6                                    | `earnings.yearToDate`        |
| `src/components/features/earnings/PayoutScheduleInfo.tsx`          | 3                                    | `earnings.payout`            |
| `src/components/features/earnings/TransactionStatusBadge.tsx`      | 4                                    | `earnings.transactionStatus` |
| `src/components/features/experience/ArchiveConfirmModal.tsx`       | 4                                    | `experience.archiveModal`    |
| `src/components/features/experience/ExperienceManagementCard.tsx`  | 15+ (toast messages + button labels) | `experience.management`      |

### 2.2 Partially-localized components with hardcoded strings

| File                                                                               | Hardcoded Strings                                                                     | Fix                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `src/app/[locale]/(protected)/dashboard/bookings/loading.tsx:5`                    | `"Chargement des réservations..."`                                                    | Replace with `t('loading')` from `bookings` namespace |
| `src/app/[locale]/(protected)/dashboard/experiences/page.tsx:60-72`                | "Manage Experiences", subtitle, "New Experience"                                      | Add to `experience` namespace                         |
| `src/app/[locale]/(protected)/dashboard/experiences/[id]/preview/page.tsx:113-154` | "Preview Mode", "Back to Dashboard", "Edit Experience", draft notice                  | Add to `experience.preview` namespace                 |
| `src/app/[locale]/(protected)/dashboard/experiences/[id]/edit/page.tsx:128-137`    | "Back to Experiences", "Edit Experience", description                                 | Add to `experience.edit` namespace                    |
| `src/app/[locale]/(protected)/dashboard/earnings/page.tsx:61-75`                   | Stripe setup banner text                                                              | Add to `stripe.onboarding` namespace                  |
| `src/app/[locale]/(protected)/dashboard/settings/layout.tsx:12-14`                 | "Settings", subtitle                                                                  | Add to `settings` namespace                           |
| `src/app/[locale]/(protected)/dashboard/winery/profile/page.tsx:66-128`            | "Manage your winery profile", "Last updated", "View Public Profile", "Payment Status" | Add to `winery.profile` namespace                     |
| `src/components/features/earnings/EarningsPageHeader.tsx:33-36`                    | "Earnings", subtitle, "Dashboard" breadcrumb                                          | Add to `earnings` namespace                           |
| `src/components/features/booking/calendar/CalendarView.tsx:61`                     | `WEEKDAYS = ['Mon', 'Tue', ...]`                                                      | Use `date-fns` locale-aware day formatting            |
| `src/components/features/booking/calendar/CalendarView.tsx:180-199`                | "Blocked", "Today", "Booking count"                                                   | Add to `bookings.calendar` namespace                  |
| `src/components/features/booking/calendar/WeekView.tsx`                            | "Week of" template literal                                                            | Add to `bookings.calendar` namespace                  |
| `src/app/[locale]/(protected)/dashboard/bookings/BookingsPageHeader.tsx:19`        | "Bookings" title                                                                      | Add to `bookings` namespace                           |

### 2.3 Locale file updates

After extracting all strings:

1. Add keys to `messages/en.json`
2. Translate and add to `messages/fr.json` (default locale — highest priority)
3. Translate and add to `messages/de.json`
4. Run `npm run i18n:check` to verify parity

---

## Phase 3: Accessibility (WCAG 2.1)

**Priority:** HIGH — Screen reader and keyboard users blocked
**Estimated files:** 12

### 3.1 Table accessibility

**Files:** `BookingsTable.tsx`, `TransactionTable.tsx`

- [ ] Add `scope="col"` to all `<th>` elements
- [ ] Add `aria-label` to `<table>` element (e.g., `aria-label={t('bookingsTable')}`)
- [ ] Add `aria-label` to Approve/Reject icon buttons (not just `title`)
- [ ] Add `aria-label` to MoreVertical dropdown trigger button
- [ ] Add descriptive `aria-label` to pagination Previous/Next buttons

### 3.2 Chart accessibility

**File:** `EarningsChart.tsx`

- [ ] Wrap chart container in `<div role="region" aria-label={t('chart.revenueEvolution')}>`
- [ ] Add visually-hidden data table alternative below chart
- [ ] Or add `aria-describedby` linking to chart description paragraph

### 3.3 Calendar accessibility

**Files:** `CalendarView.tsx`, `WeekView.tsx`

- [ ] Add `aria-label` with full date to each clickable day cell
- [ ] Add visible focus ring: `focus:ring-2 focus:ring-primary focus:ring-offset-2`
- [ ] Add `aria-hidden="true"` to breadcrumb separator `/` characters

### 3.4 Form accessibility

| File                              | Fix                                                        |
| --------------------------------- | ---------------------------------------------------------- |
| `BookingSearch.tsx`               | Add `aria-label={t('search.placeholder')}` to search input |
| `ExperienceFilters.tsx:99`        | Add `aria-label` or associated `<label>` to search input   |
| `NotificationPreferencesForm.tsx` | Add explicit `aria-label` to Switch fields                 |
| `LocationSection.tsx:23`          | Replace plain `<label>` with `FormLabel` component         |
| `winery/profile/page.tsx`         | Add `aria-hidden="true"` to decorative inline SVGs         |
| `WineryMediaSection.tsx`          | Add `aria-hidden="true"` to decorative inline SVGs         |

---

## Phase 4: Error Boundaries & Missing States

**Priority:** MEDIUM-HIGH — Users see white screens on failure
**Estimated files:** 8 new + 4 edits

### 4.1 Add error.tsx boundaries

Create `error.tsx` with appropriate error UI in:

- [ ] `src/app/[locale]/(protected)/dashboard/error.tsx` (root dashboard catch-all)
- [ ] `src/app/[locale]/(protected)/dashboard/earnings/error.tsx`
- [ ] `src/app/[locale]/(protected)/dashboard/experiences/error.tsx`
- [ ] `src/app/[locale]/(protected)/dashboard/bookings/error.tsx`

### 4.2 Fix fake/broken data displays

| File                         | Issue                                                | Fix                                                                                    |
| ---------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `BookingSummaryCards.tsx:21` | Trend always shows "12%" — fake data                 | Implement real month-over-month calculation in query, or remove trend display entirely |
| `EarningsPeriodSelector.tsx` | Component renders but queries ignore selected period | Either wire period param into earnings queries or hide the selector                    |

### 4.3 Add missing confirmation dialogs

| File                     | Action                                   | Fix                                          |
| ------------------------ | ---------------------------------------- | -------------------------------------------- |
| `WineryMediaSection.tsx` | Gallery image deletion — no confirmation | Add `AlertDialog` confirmation before delete |

### 4.4 Fix disabled affordance

| File                             | Issue                                   | Fix                                                                           |
| -------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| `WineryMediaSection.tsx:187-193` | Drag handle button visible but disabled | Hide with `className="hidden"` or remove until drag-to-reorder is implemented |

---

## Phase 5: Design Token Alignment

**Priority:** MEDIUM — Visual inconsistency, maintenance burden
**Estimated files:** 25+

### 5.1 Bulk color replacements

These can be done as find-and-replace across the codebase:

| Find                                            | Replace With                                     | Est. Instances |
| ----------------------------------------------- | ------------------------------------------------ | -------------- |
| `text-[#915564]`                                | `text-muted-foreground`                          | ~40            |
| `bg-[#f8f6f6]` / `hover:bg-[#f8f6f6]`           | `bg-primary-light` / `hover:bg-primary-light`    | ~8             |
| `divide-[#f2e9eb]`                              | `divide-border`                                  | ~2             |
| `hover:bg-[#fbf9f9]`                            | `hover:bg-secondary`                             | ~2             |
| `border-[#e5dbdd]`                              | `border-border`                                  | ~4             |
| `placeholder-[#915564]`                         | `placeholder-muted-foreground`                   | ~1             |
| `text-[#078859]`                                | `text-emerald-600` (or add `text-success` token) | ~1             |
| `text-gray-600` / `text-gray-500` (in sidebars) | `text-muted-foreground`                          | ~6             |
| `hover:bg-gray-100` (in sidebars)               | `hover:bg-primary/5`                             | ~4             |
| `bg-gray-200` (in sidebars)                     | `bg-secondary`                                   | ~2             |

### 5.2 BookingStatusBadge token alignment

**File:** `BookingStatusBadge.tsx`

All badge colors are hardcoded hex. Replace with existing Badge component variants or CSS variables:

```
bg-[#ecfdf5] text-[#047857] border-[#d1fae5] → Badge variant="success"
bg-[#fffbeb] text-[#b45309] border-[#fef3c7] → Badge variant="warning"
bg-[#fef2f2] text-[#dc2626] border-[#fee2e2] → Badge variant="destructive"
```

### 5.3 NotificationPreferencesForm brand alignment

**File:** `NotificationPreferencesForm.tsx`

Replace off-brand colors:
| Current | Replace With |
|---------|-------------|
| `bg-blue-50`, `text-blue-600` | `bg-primary-light`, `text-primary` |
| `bg-green-50`, `text-green-600` | `bg-primary-light`, `text-primary` (or keep green for "active" semantic) |
| `bg-amber-50`, `text-amber-600` | `bg-primary-light`, `text-primary` (or keep amber for "alert" semantic) |

### 5.4 StripeWarningBanner token alignment

**File:** `StripeWarningBanner.tsx`

Replace `amber-100/300/800` with gold design tokens (`gold-50`, `gold-200`, `gold-800`) for brand consistency.

### 5.5 Standardize card padding

Adopt a consistent padding scale across all dashboard cards:

- KPI/summary cards: `p-6`
- List/table cards: `p-0` (internal padding on rows)
- Form cards: `p-6 sm:p-8`
- Calendar panels: `p-4`

---

## Phase 6: Navigation & Layout Polish

**Priority:** MEDIUM — Discoverability and consistency
**Estimated files:** 5

### 6.1 Add winery profile to WINEMAKER sidebar

**File:** `DashboardSidebar.tsx`

The winery profile (`/dashboard/winery/profile`) is critical for Stripe onboarding and gallery management but is missing from sidebar navigation. Add it:

```typescript
{ href: '/dashboard/winery/profile', labelKey: 'wineryProfile', icon: Wine, exact: false }
```

Add corresponding i18n keys: `nav.wineryProfile` in all 3 locale files.

### 6.2 Fix sidebar background color

**File:** `src/app/[locale]/(protected)/dashboard/layout.tsx`

Replace hardcoded `bg-[#f8f6f6]` (2 instances) with `bg-primary-light`.

### 6.3 Replace console.error with logger

**File:** `ExportCSVButton.tsx:57`

Replace `console.error('Export failed:', error)` with `logError('CSV export failed', { error })`.

### 6.4 Fix currency formatting consistency

**File:** `EarningsChart.tsx:45`

Replace inline `.toLocaleString('de-CH', ...)` with `formatCHF()` or `formatCHFCompact()` utility.

### 6.5 Consider adding breadcrumbs

The `Breadcrumb.tsx` shared component exists with proper SEO/a11y but is unused in the dashboard. Consider adding to:

- `/dashboard/experiences/[id]/edit`
- `/dashboard/experiences/[id]/preview`
- `/dashboard/settings/notifications`
- `/dashboard/winery/profile`

---

## Appendix: Full Issue Inventory

### By Severity

| Severity | Categories                                                            | Individual Instances |
| -------- | --------------------------------------------------------------------- | -------------------- |
| CRITICAL | 3 (dead buttons, non-localized components, hardcoded strings)         | ~130+ strings        |
| HIGH     | 4 (table a11y, chart a11y, calendar a11y, form a11y)                  | ~25 elements         |
| MEDIUM   | 9 (color tokens, padding, buttons, error boundaries, fake data, etc.) | ~80+ instances       |
| LOW      | 4 (console, formatting, breadcrumbs, polling)                         | ~5 instances         |

### By Dashboard Section

| Section                 | Critical                                                             | High                              | Medium                                         | Low             |
| ----------------------- | -------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------- | --------------- |
| Sidebar/Layout          | 2 dead profile cards                                                 | —                                 | 12 hardcoded colors                            | —               |
| Bookings (Reservations) | 1 dead link, loading.tsx i18n, calendar strings                      | Table a11y (6), calendar a11y (3) | 40+ color tokens, fake trend                   | 1 console.error |
| Experiences             | 4 dead toolbar buttons, 1 dead preview button, 30+ strings           | Form a11y (2)                     | Card padding inconsistency                     | —               |
| Earnings (Revenue)      | 2 dead dropdown items, 1 broken link, 1 fake breadcrumb, 35+ strings | Chart a11y (3)                    | Period selector broken, currency formatting    | —               |
| Settings (Parametres)   | 15+ strings (notifications), 17+ strings (access guard)              | SVG a11y (4)                      | Brand colors mismatch, no image delete confirm | —               |

### Files Requiring Changes (by phase)

**Phase 1 (7 files):**

```
src/components/features/earnings/TransactionTable.tsx
src/components/features/experience/form-sections/BasicInfoSection.tsx
src/components/features/experience/form-sections/MediaSection.tsx
src/components/layout/DashboardSidebar.tsx
src/components/layout/ClientDashboardSidebar.tsx
src/app/[locale]/(protected)/dashboard/bookings/BookingsPageHeader.tsx
src/app/[locale]/(protected)/dashboard/earnings/EarningsTransactionsSection.tsx
```

**Phase 2 (20+ component files + 3 locale files):**

```
src/components/features/winery/WineryAccessGuard.tsx
src/components/features/settings/NotificationPreferencesForm.tsx
src/components/features/winery/StripeCallbackResult.tsx
src/components/features/winery/PaymentStatus.tsx
src/components/features/winery/StripeOnboarding.tsx
src/components/features/winery/StripeWarningBanner.tsx
src/components/features/earnings/EarningsChart.tsx
src/components/features/earnings/YearToDateSummary.tsx
src/components/features/earnings/PayoutScheduleInfo.tsx
src/components/features/earnings/EarningsPageHeader.tsx
src/components/features/earnings/TransactionStatusBadge.tsx
src/components/features/experience/ArchiveConfirmModal.tsx
src/components/features/experience/ExperienceManagementCard.tsx
src/components/features/booking/calendar/CalendarView.tsx
src/components/features/booking/calendar/WeekView.tsx
src/app/[locale]/(protected)/dashboard/bookings/BookingsPageHeader.tsx
src/app/[locale]/(protected)/dashboard/bookings/loading.tsx
src/app/[locale]/(protected)/dashboard/experiences/page.tsx
src/app/[locale]/(protected)/dashboard/experiences/[id]/preview/page.tsx
src/app/[locale]/(protected)/dashboard/experiences/[id]/edit/page.tsx
src/app/[locale]/(protected)/dashboard/earnings/page.tsx
src/app/[locale]/(protected)/dashboard/settings/layout.tsx
src/app/[locale]/(protected)/dashboard/winery/profile/page.tsx
messages/en.json
messages/fr.json
messages/de.json
```

**Phase 3 (12 files):**

```
src/components/features/booking/dashboard/BookingsTable.tsx
src/components/features/earnings/TransactionTable.tsx
src/components/features/earnings/EarningsChart.tsx
src/components/features/booking/calendar/CalendarView.tsx
src/components/features/booking/calendar/WeekView.tsx
src/components/features/booking/dashboard/BookingSearch.tsx
src/components/features/experience/ExperienceFilters.tsx
src/components/features/settings/NotificationPreferencesForm.tsx
src/components/features/experience/form-sections/LocationSection.tsx
src/app/[locale]/(protected)/dashboard/winery/profile/page.tsx
src/components/features/winery/WineryMediaSection.tsx
src/components/features/earnings/EarningsPageHeader.tsx
```

**Phase 4 (8 new + 4 edits):**

```
NEW: src/app/[locale]/(protected)/dashboard/error.tsx
NEW: src/app/[locale]/(protected)/dashboard/earnings/error.tsx
NEW: src/app/[locale]/(protected)/dashboard/experiences/error.tsx
NEW: src/app/[locale]/(protected)/dashboard/bookings/error.tsx
EDIT: src/components/features/booking/dashboard/BookingSummaryCards.tsx
EDIT: src/components/features/earnings/EarningsPeriodSelector.tsx
EDIT: src/components/features/winery/WineryMediaSection.tsx (confirm dialog + hide drag handle)
```

**Phase 5 (25+ files):**

```
Bulk find-replace across all files listed in section 5.1
Plus targeted edits to:
src/components/features/booking/dashboard/BookingStatusBadge.tsx
src/components/features/settings/NotificationPreferencesForm.tsx
src/components/features/winery/StripeWarningBanner.tsx
```

**Phase 6 (5 files):**

```
src/components/layout/DashboardSidebar.tsx
src/app/[locale]/(protected)/dashboard/layout.tsx
src/components/features/booking/dashboard/ExportCSVButton.tsx
src/components/features/earnings/EarningsChart.tsx
messages/en.json + fr.json + de.json (nav.wineryProfile key)
```
