# Epic 8: Production Hardening

## Status

Ready for Development

## Epic Goal

Stabiliser et sécuriser l'application EnCave avant le lancement public en corrigeant toutes les vulnérabilités critiques, en complétant l'internationalisation, en améliorant le SEO, et en renforçant la robustesse du back-end.

## Epic Description

### Existing System Context

- **Current relevant functionality:** MVP complet avec authentification, gestion des expériences, flux de réservation/paiement, dashboard winemaker, i18n (FR/DE/EN), et système de notifications
- **Technology stack:** Next.js 14, React 18, TypeScript, Prisma, PostgreSQL (Neon), Stripe Connect, NextAuth.js v5, next-intl
- **Integration points:** Stripe webhooks, Resend emails, Vercel Blob storage, Sentry (non configuré)

### Enhancement Details

- **What's being fixed:**
  - 2 vulnérabilités de sécurité critiques (P0)
  - 10 issues haute priorité (P1)
  - 12+ améliorations moyennes (P2)
- **How it integrates:** Corrections ciblées dans les composants existants, ajout de headers de sécurité, complétion des traductions
- **Success criteria:**
  - Tous les secrets rotés et sécurisés
  - Security headers implémentés (score A+ sur securityheaders.com)
  - i18n 100% complet (0 texte hardcodé EN)
  - Schema.org sur toutes les pages publiques
  - Race conditions éliminées
  - Score Lighthouse SEO > 95

## Audit Summary

| Domaine | Score Avant | Cible Après |
|---------|-------------|-------------|
| Code Quality | 98/100 | 99/100 |
| Architecture | 8.5/10 | 9/10 |
| Front-end | 8/10 | 9/10 |
| Back-end | 7/10 | 8.5/10 |
| SEO | 7.5/10 | 9/10 |
| Sécurité | 6/10 | 9/10 |
| **Global** | **7.5/10** | **9/10** |

## Issue Reference Matrix

| Issue ID | Severity | Story | Description |
|----------|----------|-------|-------------|
| SEC-001 | P0 | 8.1 | Secrets exposés dans Git |
| SEC-002 | P0 | 8.1 | AccessToken stocké en plaintext |
| SEC-003 | P1 | 8.1 | Security headers manquants (CSP, HSTS) |
| SEC-004 | P1 | 8.1 | Unsubscribe token sans expiration |
| SEC-005 | P2 | 8.1 | Complexité password insuffisante |
| SEC-006 | P2 | 8.1 | Rate limiter in-memory non scalable |
| I18N-001 | P1 | 8.2 | DashboardSidebar labels hardcodés EN |
| I18N-002 | P1 | 8.2 | BookingsEmptyState textes EN |
| I18N-003 | P1 | 8.2 | PaginationComponent textes EN |
| I18N-004 | P1 | 8.2 | GuestCountInput "Loading..." EN |
| I18N-005 | P2 | 8.2 | Métadonnées legal pages non traduites |
| A11Y-001 | P1 | 8.2 | prefers-reduced-motion non supporté |
| SEO-001 | P1 | 8.3 | Winery pages sans schema.org |
| SEO-002 | P1 | 8.3 | Experience schema incomplet (startDate) |
| SEO-003 | P2 | 8.3 | Home page sans schema Organization |
| SEO-004 | P2 | 8.3 | Experiences listing sans schema |
| SEO-005 | P2 | 8.3 | Breadcrumbs sans schema |
| SEO-006 | P2 | 8.3 | Blur placeholders non utilisés |
| BACK-001 | P0 | 8.4 | Race condition double booking |
| BACK-002 | P0 | 8.4 | Auth.ts unhandled error throw |
| BACK-003 | P1 | 8.4 | Null check timeSlot parsing NaN |
| BACK-004 | P1 | 8.4 | Email failure sans retry |
| BACK-005 | P2 | 8.4 | Sentry non intégré |
| BACK-006 | P2 | 8.4 | URLs email hardcodées |
| BACK-007 | P2 | 8.4 | Logging non structuré |
| ARCH-001 | P2 | 8.5 | Missing pagination searchExperiences |
| ARCH-002 | P2 | 8.5 | Pas de caching revalidateTag |
| ARCH-003 | P2 | 8.5 | Stripe singleton dupliqué |
| PERF-001 | P2 | 8.5 | Web Vitals reporting inactif |
| PERF-002 | P2 | 8.5 | N+1 query checkout reference loop |
| CODE-001 | P3 | 8.5 | 14 console.log dans webhooks |

## Stories

| # | Story | Priority | Issues Covered | Effort |
|---|-------|----------|----------------|--------|
| 8.1 | Security Hardening | P0/P1 | SEC-001 to SEC-006 | L |
| 8.2 | i18n & Accessibility Completion | P1 | I18N-001 to I18N-005, A11Y-001 | M |
| 8.3 | SEO Schema & Optimization | P1/P2 | SEO-001 to SEO-006 | M |
| 8.4 | Back-end Robustness | P0/P1/P2 | BACK-001 to BACK-007 | L |
| 8.5 | Performance & Code Polish | P2/P3 | ARCH-001 to ARCH-003, PERF-001 to PERF-002, CODE-001 | M |

---

## Story 8.1: Security Hardening

**As a** platform operator,
**I want** all security vulnerabilities fixed and proper security headers in place,
**So that** user data is protected and the platform meets security standards.

### Acceptance Criteria

#### P0 - Critical (Before any deployment)

1. **Secrets Rotation** (SEC-001)
   - [ ] Generate new `AUTH_SECRET` (min 32 chars, random)
   - [ ] Create new database user with strong password
   - [ ] Regenerate `STRIPE_SECRET_KEY` in Stripe Dashboard
   - [ ] Regenerate `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET`
   - [ ] Regenerate `BLOB_READ_WRITE_TOKEN`
   - [ ] Clean Git history with `git filter-repo` or BFG
   - [ ] Verify `.gitignore` prevents future commits of `.env*`

2. **AccessToken Fix** (SEC-002)
   - [ ] Remove `accessToken` plaintext field from Booking model
   - [ ] Keep only `accessTokenHash` for verification
   - [ ] Update `getBookingByToken()` to hash input before comparison
   - [ ] Migration: Set existing `accessToken` fields to null
   - [ ] File: `src/app/api/webhooks/stripe/checkout/route.ts:146-156`

#### P1 - High Priority

3. **Security Headers** (SEC-003)
   - [ ] Add `Content-Security-Policy` header in `next.config.js`
   - [ ] Add `X-Frame-Options: SAMEORIGIN`
   - [ ] Add `X-Content-Type-Options: nosniff`
   - [ ] Add `X-XSS-Protection: 1; mode=block`
   - [ ] Add `Referrer-Policy: strict-origin-when-cross-origin`
   - [ ] Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - [ ] Add `Permissions-Policy: geolocation=(), microphone=(), camera=()`
   - [ ] Test with securityheaders.com (target: A+ rating)

4. **Unsubscribe Token Expiration** (SEC-004)
   - [ ] Add `unsubscribeTokenExpiresAt` field to NotificationPreferences
   - [ ] Set expiration to 30 days from creation
   - [ ] Validate expiration in `/api/unsubscribe/[token]` route
   - [ ] Regenerate token on expiration

#### P2 - Medium Priority

5. **Password Complexity** (SEC-005)
   - [ ] Update `passwordSchema` in `src/lib/validators/auth.ts`
   - [ ] Require: 1 uppercase, 1 lowercase, 1 special character
   - [ ] Update password hint text in registration form
   - [ ] Update translations for new validation messages

6. **Rate Limiter Scalability** (SEC-006)
   - [ ] Configure Upstash Redis for production
   - [ ] Add environment check to force Redis in production
   - [ ] Keep in-memory for development
   - [ ] File: `src/server/services/rate-limit.service.ts`

### Technical Notes

```typescript
// next.config.js - Security Headers
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https:; connect-src 'self' https://api.stripe.com https://checkout.stripe.com; frame-src https://checkout.stripe.com https://js.stripe.com;"
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
];
```

### Definition of Done

- [ ] All secrets rotated and verified working
- [ ] Git history cleaned of sensitive data
- [ ] Security headers return A+ on securityheaders.com
- [ ] AccessToken no longer stored in plaintext
- [ ] Unsubscribe tokens expire after 30 days
- [ ] Password validation enforces complexity rules

---

## Story 8.2: i18n & Accessibility Completion

**As a** French or German-speaking user,
**I want** the entire interface in my language,
**So that** I can use the platform without encountering English text.

### Acceptance Criteria

#### P1 - High Priority

1. **DashboardSidebar Translation** (I18N-001)
   - [ ] Replace hardcoded labels with `t('nav.bookings')`, etc.
   - [ ] Add translations to `messages/{fr,de,en}.json`
   - [ ] Labels: Bookings, Earnings, Experiences, Winery Profile, Settings
   - [ ] "Your Winery" header
   - [ ] File: `src/components/layout/DashboardSidebar.tsx`

2. **BookingsEmptyState Translation** (I18N-002)
   - [ ] Replace "No bookings yet" with `t('bookings.empty.title')`
   - [ ] Replace "Share your experiences..." with translation
   - [ ] Replace "Manage Experiences" button text
   - [ ] File: `src/components/features/booking/dashboard/BookingsEmptyState.tsx`

3. **PaginationComponent Translation** (I18N-003)
   - [ ] Replace "Showing X to Y of Z results" with `t('common.pagination.showing')`
   - [ ] Replace "Show" dropdown label
   - [ ] Replace "No results" message
   - [ ] Replace page navigation aria-labels
   - [ ] File: `src/components/shared/Pagination.tsx`

4. **GuestCountInput Translation** (I18N-004)
   - [ ] Replace "Loading..." with `t('common.loading')`
   - [ ] File: `src/components/features/booking/GuestCountInput.tsx`

5. **prefers-reduced-motion Support** (A11Y-001)
   - [ ] Add CSS media query in `globals.css`
   - [ ] Reduce/disable animations for users with vestibular disorders
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

#### P2 - Medium Priority

6. **Legal Pages Metadata** (I18N-005)
   - [ ] Add `metadata.privacy`, `metadata.terms`, `metadata.cancellation` to messages
   - [ ] Update `generateMetadata()` for legal pages to use translations

7. **Other Hardcoded Strings**
   - [ ] ExperienceGallery: "Gallery" header
   - [ ] DayDetailPanel: "Bookings" label
   - [ ] Any other discovered hardcoded text

### Translation Keys to Add

```json
{
  "nav": {
    "bookings": "Réservations",
    "earnings": "Revenus",
    "experiences": "Expériences",
    "wineryProfile": "Profil du domaine",
    "settings": "Paramètres",
    "yourWinery": "Votre domaine"
  },
  "bookings": {
    "empty": {
      "title": "Pas encore de réservations",
      "description": "Partagez vos expériences pour recevoir vos premières réservations",
      "action": "Gérer les expériences"
    }
  },
  "common": {
    "loading": "Chargement...",
    "pagination": {
      "showing": "Affichage de {from} à {to} sur {total} résultats",
      "show": "Afficher",
      "noResults": "Aucun résultat",
      "firstPage": "Première page",
      "previousPage": "Page précédente",
      "nextPage": "Page suivante",
      "lastPage": "Dernière page"
    }
  }
}
```

### Definition of Done

- [ ] Zero hardcoded English text in UI
- [ ] All 3 language files (FR/DE/EN) updated
- [ ] Manual QA pass in each language
- [ ] prefers-reduced-motion respected
- [ ] Lighthouse Accessibility score maintained

---

## Story 8.3: SEO Schema & Optimization

**As a** search engine crawler,
**I want** complete structured data on all public pages,
**So that** EnCave appears with rich snippets in search results.

### Acceptance Criteria

#### P1 - High Priority

1. **Winery Schema.org** (SEO-001)
   - [ ] Add `LocalBusiness` or `Winery` schema to `/wineries/[slug]` pages
   - [ ] Include: name, description, address, telephone, image, geo coordinates
   - [ ] Include: openingHours (if available), priceRange
   - [ ] File: `src/app/[locale]/(public)/wineries/[slug]/page.tsx`

2. **Experience Schema Completion** (SEO-002)
   - [ ] Add `startDate` to Event schema (next available date)
   - [ ] Add `endDate` (startDate + duration)
   - [ ] Add `maximumAttendeeCapacity`
   - [ ] Add `remainingAttendeeCapacity` (dynamic)
   - [ ] File: `src/app/[locale]/(public)/experiences/[slug]/page.tsx`

#### P2 - Medium Priority

3. **Home Page Schema** (SEO-003)
   - [ ] Add `Organization` schema with EnCave details
   - [ ] Include: name, logo, url, description, areaServed
   - [ ] Include: sameAs (social links when available)
   - [ ] File: `src/app/[locale]/(public)/page.tsx`

4. **Experiences Listing Schema** (SEO-004)
   - [ ] Add `CollectionPage` or `ItemList` schema
   - [ ] Reference individual experiences
   - [ ] File: `src/app/[locale]/(public)/experiences/page.tsx`

5. **Breadcrumb Schema** (SEO-005)
   - [ ] Add `BreadcrumbList` schema to breadcrumb component
   - [ ] Auto-generate from navigation path
   - [ ] File: `src/components/shared/Breadcrumb.tsx`

6. **Image Blur Placeholders** (SEO-006)
   - [ ] Ensure all hero images use `placeholder="blur"`
   - [ ] Verify `blurDataURL` from `IMAGE_PLACEHOLDERS`
   - [ ] Audit all `next/image` usage for consistency

### Schema Examples

```typescript
// Winery LocalBusiness Schema
const winerySchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `https://encave.ch/wineries/${winery.slug}`,
  "name": winery.name,
  "description": winery.description,
  "image": winery.coverPhoto,
  "telephone": winery.phone,
  "address": {
    "@type": "PostalAddress",
    "streetAddress": winery.address,
    "addressLocality": winery.commune,
    "addressRegion": "Valais",
    "addressCountry": "CH"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": winery.latitude,
    "longitude": winery.longitude
  }
};

// Organization Schema (Home)
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "EnCave",
  "url": "https://encave.ch",
  "logo": "https://encave.ch/logo.png",
  "description": "Plateforme de réservation d'expériences viticoles en Valais",
  "areaServed": {
    "@type": "Place",
    "name": "Valais, Switzerland"
  }
};
```

### Definition of Done

- [ ] All winery pages have LocalBusiness schema
- [ ] Experience schema includes dates and capacity
- [ ] Home page has Organization schema
- [ ] Breadcrumbs have BreadcrumbList schema
- [ ] Google Rich Results Test passes for all page types
- [ ] Lighthouse SEO score > 95

---

## Story 8.4: Back-end Robustness

**As a** platform operator,
**I want** all backend race conditions and edge cases handled,
**So that** bookings are reliable and errors are properly tracked.

### Acceptance Criteria

#### P0 - Critical

1. **Race Condition Fix** (BACK-001)
   - [ ] Implement transaction with SELECT FOR UPDATE or optimistic locking
   - [ ] Add unique constraint on (experienceId, date, timeSlot) for max capacity
   - [ ] Test with concurrent booking requests
   - [ ] File: `src/server/actions/booking.ts:101-121`

2. **Auth Error Handling** (BACK-002)
   - [ ] Wrap `throw error` in proper try/catch
   - [ ] Return ActionResult error instead of throwing
   - [ ] File: `src/server/actions/auth.ts:86`

#### P1 - High Priority

3. **TimeSlot Validation** (BACK-003)
   - [ ] Validate "HH:mm" format before parsing
   - [ ] Throw explicit error for invalid format instead of defaulting to 0
   - [ ] Add Zod schema for timeSlot format
   - [ ] File: `src/server/actions/booking.ts:287-289`

4. **Email Retry Queue** (BACK-004)
   - [ ] Implement retry logic for failed emails (3 attempts, exponential backoff)
   - [ ] Log failed emails for admin review
   - [ ] Consider: Bull queue or simple retry wrapper
   - [ ] File: `src/server/services/email.service.ts`

#### P2 - Medium Priority

5. **Sentry Integration** (BACK-005)
   - [ ] Add `Sentry.captureException()` to all catch blocks
   - [ ] Configure Sentry DSN in production
   - [ ] Add context (userId, bookingId) to errors
   - [ ] File: All `src/server/actions/*.ts`

6. **Email URL Fix** (BACK-006)
   - [ ] Replace hardcoded `'https://encave.ch/'` with `getBaseUrl()`
   - [ ] Support preview/staging environments
   - [ ] File: `src/server/services/email.service.ts`

7. **Structured Logging** (BACK-007)
   - [ ] Consider Winston or Pino logger
   - [ ] Add log levels (error, warn, info, debug)
   - [ ] Add context fields (userId, action, timestamp)
   - [ ] Replace console.log/error with logger calls

### Technical Implementation

```typescript
// Race condition fix with transaction
async function createBookingWithLock(input: BookingInput) {
  return db.$transaction(async (tx) => {
    // Lock the slots for this experience/date/time
    const existingBookings = await tx.booking.findMany({
      where: {
        experienceId: input.experienceId,
        date: input.date,
        timeSlot: input.timeSlot,
        status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }
      },
      select: { guestCount: true }
    });

    const bookedCount = existingBookings.reduce((sum, b) => sum + b.guestCount, 0);
    const remainingCapacity = experience.maxCapacity - bookedCount;

    if (input.guestCount > remainingCapacity) {
      throw new Error('NO_CAPACITY');
    }

    // Create booking within same transaction
    return tx.booking.create({ data: { ... } });
  }, {
    isolationLevel: 'Serializable' // Prevents race conditions
  });
}

// TimeSlot validation
const timeSlotSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format');
```

### Definition of Done

- [ ] Concurrent booking test passes (no double bookings)
- [ ] All errors return ActionResult (no unhandled throws)
- [ ] TimeSlot parsing validated with clear errors
- [ ] Failed emails retry 3 times before giving up
- [ ] Sentry captures all production errors
- [ ] Email URLs work in preview deployments

---

## Story 8.5: Performance & Code Polish

**As a** developer,
**I want** clean, optimized code with proper monitoring,
**So that** the platform performs well and is maintainable.

### Acceptance Criteria

#### P2 - Medium Priority

1. **Pagination Implementation** (ARCH-001)
   - [ ] Add `page` and `limit` params to `searchExperiences()`
   - [ ] Return total count for pagination UI
   - [ ] Default: 20 items per page
   - [ ] File: `src/server/queries/experience.queries.ts`

2. **Caching Strategy** (ARCH-002)
   - [ ] Implement `revalidateTag()` for experiences list
   - [ ] Implement `revalidatePath()` after experience create/update
   - [ ] Consider ISR for public pages
   - [ ] File: `src/server/actions/experience.ts`

3. **Stripe Singleton** (ARCH-003)
   - [ ] Create `src/server/stripe.ts` singleton
   - [ ] Import from single location
   - [ ] Remove duplicate initialization
   - [ ] Files: `src/server/services/payment.service.ts`, `src/server/actions/checkout.ts`

4. **Web Vitals Reporting** (PERF-001)
   - [ ] Enable `_sendToAnalytics()` function
   - [ ] Configure Vercel Analytics or custom endpoint
   - [ ] File: `src/lib/web-vitals.ts`

5. **N+1 Query Fix** (PERF-002)
   - [ ] Replace reference generation loop with UUID
   - [ ] Or use `cuid2` for unique booking reference
   - [ ] File: `src/server/actions/checkout.ts:130-141`

#### P3 - Low Priority

6. **Console.log Cleanup** (CODE-001)
   - [ ] Replace `console.log/error` with proper logger in webhooks
   - [ ] Or add ESLint exception comment with justification
   - [ ] Files: `src/app/api/webhooks/stripe/*.ts`, `src/server/services/email.service.ts`

### Definition of Done

- [ ] Experience search supports pagination
- [ ] Cache invalidation working for experience updates
- [ ] Stripe client initialized from single source
- [ ] Web Vitals reported to analytics
- [ ] No N+1 queries in booking flow
- [ ] ESLint passes with 0 warnings (or documented exceptions)

---

## Compatibility Requirements

- [x] Existing APIs remain unchanged (backward compatible)
- [x] Database schema changes are additive only
- [x] UI changes follow existing design system
- [x] All changes support FR/DE/EN locales
- [x] Stripe integration remains functional

## Risk Mitigation

- **Primary Risk:** Security changes could break authentication
- **Mitigation:** Test auth flow thoroughly after secret rotation
- **Rollback Plan:** Keep old secrets in secure backup until verified

- **Secondary Risk:** i18n changes could introduce new bugs
- **Mitigation:** QA each language independently
- **Rollback Plan:** Feature flag for new translations

## Definition of Done (Epic Level)

- [ ] All P0 issues resolved and verified
- [ ] All P1 issues resolved and verified
- [ ] P2 issues addressed where time permits
- [ ] Security audit score improved to 9/10
- [ ] SEO audit score improved to 9/10
- [ ] i18n 100% complete (manual verification)
- [ ] No regression in existing functionality
- [ ] Load testing passed for booking flow

## Effort Estimation

| Story | Effort | Dependencies |
|-------|--------|--------------|
| 8.1 Security | L (3-4 days) | None |
| 8.2 i18n | M (2 days) | None |
| 8.3 SEO | M (2 days) | None |
| 8.4 Back-end | L (3 days) | 8.1 (secrets) |
| 8.5 Performance | M (2 days) | None |

**Total Estimated Effort:** 12-15 days (2-3 sprints)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-14 | 1.0 | Epic creation from comprehensive audit | PM Agent |
