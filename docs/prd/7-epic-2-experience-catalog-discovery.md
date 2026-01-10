# 7. Epic 2: Experience Catalog & Discovery

## Epic Goal

Enable winemakers to create experiences and visitors to search/browse them - delivering a functional discovery platform without booking capability.

**Value delivered:** A visitor can discover wine experiences in Valais, filter by preferences, and view full details; a winemaker can publish their offerings.

---

## Story 2.1: Create Experience

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

## Story 2.2: Experience Management Dashboard

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

## Story 2.3: Experience Availability Configuration

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

## Story 2.4: Public Experience Search

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

## Story 2.5: Experience Detail Page

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

## Story 2.6: Navigation Connectivity

**As a** visitor or winemaker,
**I want** clear navigation paths to discover experiences and manage my offerings,
**so that** I can easily find what I'm looking for without knowing specific URLs.

**Acceptance Criteria:**

1. Header navigation includes "Experiences" link to `/experiences` (visible on all public pages)
2. "Experiences" link uses same styling as existing "Wineries" link with active state
3. Dashboard sidebar component created with navigation links to `/dashboard/experiences` and `/dashboard/winery/profile`
4. Sidebar displays on all `/dashboard/*` routes with active state indication
5. Sidebar includes winemaker's winery name at top
6. Sidebar is responsive (collapses on mobile)
7. Homepage includes discovery section with CTAs to `/experiences` and `/wineries`
8. All navigation links have appropriate icons (Lucide React)
9. Active state styling indicates current section in both header and sidebar
10. Mobile navigation includes all links (hamburger menu updated)

**Prerequisites:** Stories 2.1-2.5

**Rationale:** This story addresses navigation gaps discovered during Epic 2 verification. Stories 2.1-2.5 created the pages but did not explicitly include navigation paths to reach them, leaving orphan routes.

---
