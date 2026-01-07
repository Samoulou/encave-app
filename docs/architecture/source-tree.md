# EnCave Source Tree

> **Source:** Extracted and enriched from `docs/architecture.md`
> **Last Updated:** 2026-01-07

This document defines the project structure and file organization for EnCave. Follow this structure for all new code.

---

## Repository Overview

**Structure:** Single-app monorepo (not multi-package)
**Monorepo Tool:** N/A - single Next.js app, npm workspaces not needed
**Package Organization:** Flat structure within `src/`

---

## Complete Directory Structure

```
encave/
├── .github/
│   └── workflows/           # GitHub Actions CI/CD
│       ├── ci.yml           # Lint, type-check, test
│       └── deploy.yml       # Vercel deployment triggers
│
├── prisma/
│   ├── schema.prisma        # Database schema definition
│   ├── migrations/          # Database migrations
│   └── seed.ts              # Development seed data
│
├── public/
│   ├── locales/             # i18n translation files
│   │   ├── fr/              # French translations
│   │   │   ├── common.json
│   │   │   ├── booking.json
│   │   │   └── ...
│   │   └── de/              # German translations
│   │       ├── common.json
│   │       ├── booking.json
│   │       └── ...
│   ├── images/              # Static images
│   └── favicon.ico
│
├── src/
│   ├── app/                 # Next.js App Router
│   ├── components/          # React components
│   ├── lib/                 # Client utilities & constants
│   ├── server/              # Server-only code
│   └── types/               # Shared TypeScript types
│
├── tests/
│   ├── unit/                # Unit tests (mirror src/ structure)
│   ├── integration/         # Integration tests
│   └── e2e/                 # Playwright E2E tests
│
├── docs/                    # Project documentation
│   ├── architecture.md      # Full architecture document
│   ├── architecture/        # Architecture shards
│   ├── prd.md               # Product requirements
│   └── stories/             # User stories
│
├── .env.example             # Environment variable template
├── .env.local               # Local environment (git-ignored)
├── next.config.js           # Next.js configuration
├── tailwind.config.ts       # Tailwind configuration
├── tsconfig.json            # TypeScript configuration
├── package.json
└── README.md
```

---

## Source Directory (`src/`) Deep Dive

### `src/app/` - App Router Pages

```
src/app/
├── (public)/                      # Public routes (no auth required)
│   ├── page.tsx                   # Landing page (/)
│   ├── search/
│   │   └── page.tsx               # Experience search (/search)
│   ├── experience/
│   │   └── [id]/
│   │       └── page.tsx           # Experience detail (/experience/:id)
│   └── winery/
│       └── [slug]/
│           └── page.tsx           # Public winery profile (/winery/:slug)
│
├── (auth)/                        # Auth routes
│   ├── login/
│   │   └── page.tsx               # Login page
│   ├── register/
│   │   └── winemaker/
│   │       └── page.tsx           # Winemaker registration
│   └── layout.tsx                 # Auth layout (redirects if logged in)
│
├── (protected)/                   # Authenticated routes
│   ├── layout.tsx                 # Protected layout (auth check)
│   └── dashboard/                 # Winemaker dashboard
│       ├── page.tsx               # Dashboard home
│       ├── bookings/
│       │   └── page.tsx           # Booking management
│       ├── experiences/
│       │   ├── page.tsx           # Experience list
│       │   ├── new/
│       │   │   └── page.tsx       # Create experience
│       │   └── [id]/
│       │       └── edit/
│       │           └── page.tsx   # Edit experience
│       └── calendar/
│           └── page.tsx           # Availability calendar
│
├── admin/                         # Admin routes
│   ├── layout.tsx                 # Admin auth check
│   └── wineries/
│       └── page.tsx               # Winery verification queue
│
├── api/                           # API routes (webhooks only)
│   └── webhooks/
│       └── stripe/
│           └── route.ts           # Stripe webhook handler
│
├── layout.tsx                     # Root layout
├── not-found.tsx                  # 404 page
├── error.tsx                      # Error boundary
└── globals.css                    # Global styles
```

**Route Groups:**

- `(public)` - No authentication required
- `(auth)` - Auth pages, redirect if already logged in
- `(protected)` - Requires authentication
- `admin` - Requires ADMIN role

### `src/components/` - React Components

```
src/components/
├── ui/                            # shadcn/ui primitives
│   ├── button.tsx
│   ├── input.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   └── ...                        # Other shadcn components
│
├── layout/                        # App shell components
│   ├── Header.tsx                 # Main navigation header
│   ├── Footer.tsx                 # Site footer
│   ├── Sidebar.tsx                # Dashboard sidebar
│   └── MobileNav.tsx              # Mobile navigation
│
├── features/                      # Feature-specific components
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── UserMenu.tsx
│   │
│   ├── winery/
│   │   ├── WineryCard.tsx         # Winery preview card
│   │   ├── WineryProfile.tsx      # Full winery profile
│   │   ├── WineryDashboard.tsx    # Winemaker dashboard
│   │   └── StripeOnboarding.tsx   # Stripe Connect setup
│   │
│   ├── experience/
│   │   ├── ExperienceCard.tsx     # Experience preview
│   │   ├── ExperienceDetail.tsx   # Full experience page
│   │   ├── ExperienceForm.tsx     # Create/edit form
│   │   └── ExperienceGallery.tsx  # Image gallery
│   │
│   ├── booking/
│   │   ├── BookingWidget.tsx      # Date/time selector
│   │   ├── CheckoutForm.tsx       # Stripe payment form
│   │   ├── BookingConfirmation.tsx
│   │   ├── BookingsTable.tsx      # Booking list for dashboard
│   │   └── CalendarView.tsx       # Full calendar view
│   │
│   ├── search/
│   │   ├── SearchBar.tsx          # Main search input
│   │   ├── SearchFilters.tsx      # Filter controls
│   │   └── SearchResults.tsx      # Results grid
│   │
│   └── admin/
│       ├── PendingWineries.tsx    # Verification queue
│       └── AdminStats.tsx         # Dashboard stats
│
└── shared/                        # Cross-feature reusables
    ├── LoadingSpinner.tsx
    ├── EmptyState.tsx
    ├── ErrorMessage.tsx
    ├── ImageUpload.tsx
    └── LocaleSwitcher.tsx
```

**Component Types:**

- **Server Components** (default): Direct DB access, no hooks
- **Client Components** (`'use client'`): Interactivity, hooks, browser APIs

### `src/lib/` - Client Utilities

```
src/lib/
├── env.ts                         # Typed environment variables
├── utils.ts                       # General utilities (cn, etc.)
├── constants.ts                   # App-wide constants
├── formatters/
│   ├── price.ts                   # Price formatting (CHF)
│   ├── date.ts                    # Date/time formatting
│   └── index.ts                   # Barrel export
└── validators/
    ├── booking.ts                 # Booking validation schemas
    ├── experience.ts              # Experience validation schemas
    └── index.ts                   # Barrel export
```

### `src/server/` - Server-Only Code

```
src/server/
├── db.ts                          # Prisma client singleton
├── auth.ts                        # NextAuth configuration
│
├── actions/                       # Server Actions
│   ├── auth.ts                    # Authentication actions
│   ├── winery.ts                  # Winery management
│   ├── experience.ts              # Experience CRUD
│   ├── booking.ts                 # Booking operations
│   ├── availability.ts            # Schedule management
│   └── admin.ts                   # Admin operations
│
├── services/                      # Business logic services
│   ├── booking.service.ts         # Availability, conflicts, refunds
│   ├── payment.service.ts         # Stripe integration
│   ├── email.service.ts           # Resend transactional emails
│   └── availability.service.ts    # Schedule calculations
│
├── queries/                       # Database queries for RSC
│   ├── experience.queries.ts
│   ├── winery.queries.ts
│   └── booking.queries.ts
│
└── emails/                        # React Email templates
    ├── BookingConfirmation.tsx
    ├── BookingCancellation.tsx
    ├── NewBookingNotification.tsx
    └── WinemakerWelcome.tsx
```

**Important:** Code in `src/server/` must NEVER be imported by client components.

### `src/types/` - Shared Types

```
src/types/
├── index.ts                       # Barrel export
├── actions.ts                     # ActionResult<T>, ErrorCode
├── booking.ts                     # Booking-related types
├── experience.ts                  # Experience-related types
├── winery.ts                      # Winery-related types
└── user.ts                        # User/auth types
```

---

## Tests Directory

```
tests/
├── unit/                          # Fast, isolated tests
│   ├── lib/
│   │   └── formatters/
│   │       └── price.test.ts
│   └── components/
│       └── features/
│           └── booking/
│               └── BookingWidget.test.tsx
│
├── integration/                   # Tests with real DB
│   ├── setup.ts                   # Test database setup
│   └── actions/
│       ├── booking.test.ts
│       └── experience.test.ts
│
└── e2e/                           # Browser tests
    ├── playwright.config.ts
    ├── booking-flow.spec.ts
    ├── winemaker-dashboard.spec.ts
    └── fixtures/
        └── test-data.ts
```

---

## File Naming Conventions

| Type             | Convention              | Example                 |
| ---------------- | ----------------------- | ----------------------- |
| React Components | PascalCase              | `BookingWidget.tsx`     |
| Pages            | lowercase               | `page.tsx`              |
| Layouts          | lowercase               | `layout.tsx`            |
| Server Actions   | camelCase               | `booking.ts`            |
| Services         | kebab-case + `.service` | `booking.service.ts`    |
| Queries          | kebab-case + `.queries` | `experience.queries.ts` |
| Utils            | camelCase               | `formatPrice.ts`        |
| Types            | camelCase               | `booking.ts`            |
| Tests            | name + `.test.ts`       | `price.test.ts`         |
| E2E Tests        | name + `.spec.ts`       | `booking-flow.spec.ts`  |

---

## Import Aliases

Configured in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Usage:**

```typescript
// Instead of relative imports
import { Button } from '../../../components/ui/button';

// Use absolute imports
import { Button } from '@/components/ui/button';
```

---

## Where to Put New Code

| I want to add...      | Location                                   |
| --------------------- | ------------------------------------------ |
| New page              | `src/app/(group)/path/page.tsx`            |
| UI component (shadcn) | `src/components/ui/`                       |
| Feature component     | `src/components/features/{feature}/`       |
| Layout component      | `src/components/layout/`                   |
| Server Action         | `src/server/actions/{module}.ts`           |
| Business logic        | `src/server/services/{name}.service.ts`    |
| Database query        | `src/server/queries/{entity}.queries.ts`   |
| Email template        | `src/server/emails/`                       |
| Utility function      | `src/lib/` or `src/lib/formatters/`        |
| Type definition       | `src/types/{module}.ts`                    |
| Translation           | `public/locales/{locale}/{namespace}.json` |
| Unit test             | `tests/unit/` (mirror src structure)       |
| Integration test      | `tests/integration/`                       |
| E2E test              | `tests/e2e/`                               |

---

## Forbidden Patterns

1. **No server code in `src/lib/`** - Use `src/server/`
2. **No client imports from `src/server/`** - Will break build
3. **No business logic in pages** - Use actions/services
4. **No direct Prisma in components** - Use queries/actions
5. **No hardcoded strings** - Use next-intl

---

_Reference: Full architecture at `docs/architecture.md`_
