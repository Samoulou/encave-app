# CLAUDE.md — Encave App

Wine-experience booking platform, converging toward **EnCave V3** ("one engine + one shop": Slot, Stay, Request, Shop). Next.js 14 App Router, TypeScript strict, Prisma/PostgreSQL (Neon), Stripe Connect, next-intl (fr/de/en), Tailwind + shadcn/ui. Deployed on Vercel. Base URL: https://encave.ch

## V3 Convergence — read this first

The codebase is the working V2 MVP; the product target is V3. Strategy validated with Sam (2026-07):

1. **Keep what exists and works — extend it, never rewrite it** to cosmetically match V3 docs. New behavior is added on top of the current code.
2. **Everything missing is built per the V3 docs**, the product/business source of truth: `docs/v3/ENCAVE-V3-PRD.md` (scope, user stories, NFR), `docs/v3/ENCAVE-V3-BUSINESS.md` (pricing, unit economics), `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` (every screen and email), `docs/v3/ENCAVE-V3-PLANNING.md` (phases, gates, fuses). Current state vs target: `docs/ENCAVE-V3-GAP-ANALYSIS.md`.
3. **Stack decision**: the V3 docs' tech references (Supabase, Drizzle, Trigger.dev, Postgres RLS, magic link, Axiom, monorepo) are **superseded** — we stay on the stack below. This file is authoritative for tech; V3 docs for product/UX/business. "RLS 100%" translates to app-layer tenant filtering + DB invariants + role×resource tests. Deferred jobs (request reminders, scheduled gift-card delivery, J+2 email) use Vercel Cron + scheduling tables, not Trigger.dev.
4. **Launch pillars (16 Nov 2026), all still to build**: gift cards (bons cadeaux), sur-mesure requests, anti no-show (SetupIntent card imprint + configurable fee), tasting sheet → J+2 wine email loop, collective events (light). Then V3.1 Shop (Jan 2027), V3.2 Stay (Feb 2027), V3.3 reviews/widget.
5. **Every money-touching feature ships behind a feature flag** (env-based until a flag system exists) — gift cards and no-show fees must be disable-able in under a minute without a deploy.
6. **Schema changes are additive migrations** — never destructive changes to existing tables as a side effect of a feature.
7. **Routes**: existing routes keep their current (English) paths. New V3 surfaces follow the French naming of the pages inventory (`/cadeaux`, `/sur-mesure`, `/compte`, `/encaveur/*`…). Renaming an existing route requires a dedicated epic with redirects — never as a side effect.

## Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint (must pass before commit)
npm run format:check     # Prettier check (must pass before commit)
npm run i18n:check       # Verify all 3 locale files match
npm run dev:db:start     # Start dev Docker Postgres
npm run dev:db:setup     # Push schema + seed dev DB
npm run test:db:start    # Start test Docker Postgres
npm run test:e2e:setup   # Seed test DB
npm run test:e2e         # Playwright E2E tests
```

Test commands use `dotenv -e .env.test --` prefix. Never run tests against production DB.

## Technology Stack

- **Next.js** ^14.2.35 (App Router, Server Components, Server Actions)
- **React** ^18.3.1 | **TypeScript** ^5.0.0 (strict, noUncheckedIndexedAccess, noImplicitAny)
- **Prisma** ^5.22.0 — PostgreSQL (Neon), pooled `DATABASE_URL`, `DIRECT_URL` for migrations, cuid() IDs
- **better-auth** ^1.4.17 — email/password + OAuth (Google/Apple)
- **Stripe** ^20.1.2 — Connect, API version pinned `2025-12-15.clover` (never change)
- **next-intl** ^4.7.0 — locales: fr (default), de, en; localePrefix: always
- **Tailwind** ^3.4.0 + shadcn/ui (Radix + CVA) | **Prettier** with tailwindcss plugin
- **react-hook-form** ^7.70.0 + **Zod** ^4.3.5 (v4 API, not v3)
- **framer-motion** ^12.25.0 | **nuqs** ^2.8.6 (URL search params)
- **react-day-picker** ^9.13.0 (v9, not v8)
- **Pino** ^10.1.1 (structured logging) | **Sentry** ^10.33.0
- **Resend** ^6.7.0 + React Email | **Vercel Blob** ^2.0.0
- **Vitest** ^2.0.0 (jsdom) + **Playwright** ^1.57.0 (Chromium only)
- **date-fns** ^4.1.0 | **@react-pdf/renderer** ^4.3.2
- **Fonts**: Manrope (`--font-manrope`, sans) + Fraunces (`--font-fraunces`, display/serif — prices, KPIs, headings) + JetBrains Mono (`--font-mono`)

## Architecture

```
Component → Server Action → Service/Query → DB
```

- Components never import `db` or `src/server/` except via server actions
- Actions call services (complex logic) or queries (reads). May call db for simple CRUD
- Queries are read-only + cached. Never call actions/services from queries
- Services handle business logic (email, payment, upload). Never call actions

### Directory Structure

- `src/components/ui/` — shadcn/ui primitives (NEVER modify directly)
- `src/components/shared/` — project-wide reusable (EmptyState, Breadcrumb, LoadingSpinner)
- `src/components/features/{domain}/` — domain-specific components
- `src/components/layout/` — structural (Header, Footer, Sidebar)
- `src/server/actions/` — server actions (`'use server'` directive required)
- `src/server/queries/` — read-only cached queries
- `src/server/services/` — business logic services
- `src/lib/validators/` — Zod schemas (extend existing, never inline `z.object()`)
- `src/lib/constants/` — UPPER_SNAKE_CASE config constants
- `src/types/` — shared types (never export types from component files)
- Route groups: `(auth)`, `(protected)`, `(public)`, `admin`

## TypeScript Rules

- `noUncheckedIndexedAccess` is ON — indexing returns `T | undefined`. Handle it. NEVER use `!` non-null assertions
- Prefer `satisfies` over `as` — `as` lies to the compiler
- `'use server'` required at top of every file in `src/server/actions/`
- `'use client'` ONLY when component uses hooks, event handlers, or browser APIs. Default is Server Component
- App Router `params` is `Promise<{ locale: string }>` — must `await` it
- Zod v4 error formatting differs from v3 — always `safeParse()`, never `parse()` in server actions
- Prefix unused params with `_`

## Import Rules

- Always use `@/` alias (maps to `./src/`). No relative `../../` across directory boundaries
- Order: (1) React/Next.js, (2) third-party, (3) `@/` project, (4) relative (same dir only)
- NEVER `next/navigation` — use `@/i18n/navigation` (Link, useRouter, redirect, usePathname)
- NEVER `next/link` — use `@/i18n/navigation` Link
- NEVER `useParams` — use `useLocale()` from `next-intl`
- No `index.ts` barrel files — import directly from specific files

## Server Components (default)

- Fetch data with `await` in component body — no `useEffect` for server data
- `getTranslations('namespace')` from `next-intl/server`
- `setRequestLocale(locale)` at top of every page/layout server component
- Cannot be tested with `@testing-library/react` — test underlying queries/actions

## Client Components

- `useTranslations('namespace')` from `next-intl` (not `next-intl/server`)
- Forms: `react-hook-form` + `zodResolver` + server action via `useTransition`
- NEVER use raw `router.push` — use `useNavigateWithTransition` hook
- NEVER use `useSearchParams` — use `nuqs`

## Server Actions Pattern

1. `await auth()` → return UNAUTHORIZED if no session
2. `safeParse()` input with schema from `src/lib/validators/`
3. DB ops
4. Cache invalidation with `revalidateTag()`
5. Return `ActionResult<T>` from `@/types/actions` — never throw

## Caching

- `React.cache()` — request-level deduplication (same render tree)
- `unstable_cache()` with tags — persistent cross-request cache
- Combined: `cache(unstable_cache(fn, [key], { tags }))` for both
- Prefer `revalidateTag()` for granular invalidation. `revalidatePath()` only for full page-tree refresh. Never both for same data
- `invalidateExperienceCaches(winerySlug?, experienceSlug?)` — reuse for experience cache invalidation

## Utility Libraries (use these, don't reinvent)

- **Date formatting**: `src/lib/i18n/formatters.ts` — `formatDate`, `formatPrice`, `formatDuration`, `getRelativeTime`. Never raw `Intl.DateTimeFormat` or `date-fns format()` directly
- **Date arithmetic**: `date-fns` (`addDays`, `isBefore`, `differenceInHours`). Never raw Date math
- **Date conversion**: `localDateToUTC()` from formatters — required for DB date comparisons
- **Currency**: `formatCHF`, `formatCHFCompact`, `formatCHFAmount` in `src/lib/utils/currency.ts`
- **Slug generation**: `ensureUniqueSlug()` in `src/lib/utils/slug.ts`
- **Geo calculations**: `src/lib/geo-utils.ts` — Haversine, distance tiers, `sortByDistance`
- **Logging**: `src/lib/logger.ts` — `logInfo`, `logWarn`, `logError`, `logDebug`. Never `console.log`
- **Class combining**: `cn()` from `@/lib/utils`. Never manual string concatenation

## i18n

- 3 locales: `fr` (default), `de`, `en`. French is primary
- Every user-facing string goes through `useTranslations` / `getTranslations` — even "Cancel" or "OK"
- Add keys to ALL 3 locale files: `messages/en.json`, `messages/fr.json`, `messages/de.json`
- Swiss locale codes: `fr-CH`, `de-CH`, `en-CH` via `src/lib/i18n/formatters.ts`
- Run `npm run i18n:check` after adding/modifying translation keys
- DE is fully translated and routed — activating German demand (V3 "Levier 0", 2028) is a translation-freshness pass, not a build. IT is out of scope for V3

## UI Patterns

- Use Next.js `<Image>` — never raw `<img>`
- Three states for every data component: loading, empty (`EmptyState`), populated
- Mobile-first Tailwind (`sm:`, `md:`, `lg:`). Never desktop-first
- Every route segment should have `loading.tsx` and `error.tsx`

## Testing

- **Unit/integration**: `tests/unit/` mirroring `src/` structure
- **E2E**: `tests/e2e/` with Playwright (Chromium only)
- Server action tests must cover: unauthorized, validation failure, happy path
- Use `vi.mocked()` — never `as any` on mocks
- `renderHook` is built into `@testing-library/react` — don't install hooks package
- Don't test shadcn/ui primitives or render async Server Components with testing-library
- E2E: Page Object Model in `tests/e2e/pages/`
- Test env: `.env.test` + Docker Postgres

## Code Style

- **Prettier**: single quotes, semicolons, 2-space indent, trailing commas (es5), 80 char width
- **ESLint**: `next/core-web-vitals`, `no-unused-vars: error`, `no-console: warn`
- Tailwind classes auto-sorted by prettier plugin — never manually reorder
- No pre-commit hooks configured — manually run `npm run lint` and `npm run format:check` before every commit

### File Naming

- Components: `PascalCase.tsx` | Hooks: `useCamelCase.ts`
- Actions: `camelCase.ts` | Queries: `*.queries.ts` | Services: `*.service.ts`
- Validators: `camelCase.ts` | Tests: `.test.ts(x)` | E2E: `kebab-case.spec.ts`
- Next.js: lowercase (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`)

## Security

- All env vars validated via Zod in `src/lib/env.ts` — new vars must be added there
- Auth check (`await auth()`) required in every server action touching user data
- Rate limiting: dual-layer (Redis/Upstash prod, in-memory dev). Add rate limiting to new public endpoints
- Booking access tokens stored as `accessTokenHash` — never store plaintext
- Never expose Prisma types with sensitive fields to client — create DTOs
- CSP headers in `next.config.js` — check before adding external scripts/iframes
- Cron routes authenticate via `CRON_SECRET` using `src/lib/cron-auth.ts`

## Business Rules

### Roles

- `CLIENT` — books experiences, views own bookings
- `WINEMAKER` — manages winery, creates experiences, manages bookings
- `ADMIN` — verifies wineries, system oversight

### Winery Lifecycle

`PENDING` → `VERIFIED` (by admin) | `REJECTED` | `SUSPENDED`. Only `VERIFIED` wineries can create/publish experiences.

### Booking State Machine

`PENDING_PAYMENT` → `CONFIRMED` → `COMPLETED` | `CANCELLED_BY_CLIENT` | `CANCELLED_BY_WINERY` | `NO_SHOW`. Never skip states. Backward transitions are forbidden **except** for the two operational reverts `COMPLETED → CONFIRMED` and `NO_SHOW → CONFIRMED` available only to the winery owner via `revertBookingCheckIn`/`revertBookingNoShow` server actions, within 72h after the session ends, with mandatory Pino log. See [ADR-0001](./docs/adr/0001-booking-backward-status-transitions.md).

### Payments

Implemented today:

- Platform commission: 12% flat (`PLATFORM_COMMISSION_RATE` env var — never hardcode)
- Prices in cents (CHF). Display: `price / 100`. Store: `Math.round(price * 100)`
- Stripe Connect Express, destination charges (`application_fee_amount` + `transfer_data.destination`). Webhooks are source of truth for payment status
- Refund: >24h before start → full refund; <24h → no refund (single hardcoded rule)

V3 target (see `docs/v3/ENCAVE-V3-BUSINESS.md` — build incrementally, feature-flagged):

- **Client booking fee 2.50 CHF/ticket**, always a separate visible line at checkout — never blended into the price. The UI line already exists ("Frais de service", currently hardcoded to 0)
- Commission becomes **per-winery**: Founders 0% (first 20 wineries, until 31.03.2027), 10% launch rate for the rest; from Apr 2027 the grid: Découverte 0 CHF/mo + 12% · Pro 79 CHF/mo + 0% · Domaine 149 CHF/mo + 0% (+ Shop 0%); Shop 8% otherwise. Payment processing re-invoiced at cost — never margin on Stripe fees
- Per-winery cancellation policies (flexible/standard/strict) replace the fixed >24h rule
- TWINT first at checkout (currently `card` only), Link enabled, saved cards via `setup_future_usage`
- VAT: prices displayed TTC; anticipate the 100k CHF threshold (no Stripe Tax yet)

### V3 Domain Rules (target — none of these models exist yet; specs in `docs/v3/`)

- **Gift cards**: 2.50 fee at purchase, commission of the winery's tier at redemption. Append-only ledger, balance never negative (DB invariant), partial redemption, 5-year validity, transactional lock against concurrent redemption. Admin needs a total-liability view
- **Requests (sur-mesure)**: client form → winery offer (text, total price, expiry) → payment link → tickets. Visible 48h SLA; single automatic reminder before offer expiry, then closure
- **Anti no-show**: opt-in per winery, default 15 CHF/person (configurable 0–50). Free/pay-on-site offers take a card imprint via Stripe SetupIntent (no charge at booking). Charge triggered manually by the winemaker — never automatic — with client notification citing the accepted policy
- **Tasting sheet**: winemaker checks wines served per booking (≤30s on mobile) → J+2 client email "vos coups de cœur" with wines + one-click order request. Requires Wine + BookingWine models
- **Collective events**: a Slot experience can have participating wineries (logos, mini-program) + ONE paid organizer. Central ticketing, multi-point scanning. No automatic multi-winery split at launch

### Experience Rules

- Status: `DRAFT` → `PUBLISHED` → `ARCHIVED`
- Slugs unique per winery (compound), not globally
- Duration in minutes, price in cents

### Booking References

Format: `ENC-` + 8 uppercase chars derived from cuid2 (globally unique). Generated by `generateBookingReference()` in `src/server/actions/checkout.ts`.

## Modifying an existing component

When asked to "change how the experiences list works" / "tweak the booking row" / etc., **never** edit a component just because its name matches.
Two components with similar names may coexist (e.g. `ExperiencesList.tsx` and `ExperienceManagementCard.tsx`) — only one is wired into the route you care about. Before editing:

1. From the route's `page.tsx`, follow the imports down to the actual rendered component (`grep -rn "ComponentName"` on routes and parent components).
2. Confirm that file is actually imported somewhere reachable (route, layout, server component). A `0 references` count means dead code, not "ready to use".
3. Only then make your change.

If you find unused twins along the way, propose removing them (don't leave them rotting — they will trap the next agent).

## Known Debt & Pitfalls (audited 2026-07-09)

Verified against `dev` — full detail in `docs/ENCAVE-V3-GAP-ANALYSIS.md` §10 and `docs/ENCAVE-V3-PERF-AUDIT.md` (measured: home mobile Lighthouse 48, LCP 9.8s vs NFR 95/1.5s — fixes tracked as backlog epic E15). Don't rediscover these; fix them when touching the area:

- The confirmation email is sent WITHOUT `bookingId`/`accessToken` (`checkout-confirmation.service.ts`) → no QR attachment, ticket button links to the homepage, the guest magic link is never delivered. Same bug in `resendConfirmationEmail`
- Only 2 of 5 cron routes are scheduled in `vercel.json` — `expire-pending-bookings` (hold release!), `follow-ups` and `weekly-summary` never run in prod
- The on-screen confirmation QR encodes `/checkin/{bookingId}` — a route that doesn't exist and doesn't match the scanner's token format
- The Stripe **Connect** webhook has no idempotency guard (the checkout webhook has one via `StripeEvent`)
- `requestAccountDeletion` (nLPD) and `refundBookingManually` (admin) exist server-side but no UI calls them
- `ModifyBookingCard` links to the dead route `/bookings/[id]/manage`; the my-bookings "upcoming/past" tabs are non-functional
- 5 email templates ignore `locale` (hardcoded unaccented French); `sendEmail` silently returns success when `RESEND_API_KEY` is unset
- Earnings "next payout" and paid/processing statuses are date heuristics (experience + 5 business days), not real Stripe payout data; the bookings "occupancy rate" KPI is `month/(month+5)` — a placeholder, not a metric
- The receipt PDF claims "Taxes et frais de service inclus" while no VAT is computed anywhere
- Dead code: `HowItWorks.tsx`, `PopularExperiences.tsx`, `HeroSearchBar.tsx` (unimported)
- The middleware hardcodes the Coming Soon gate on `encave.ch` — remove at launch

## NEVER Do These

- Import from `next/navigation` or `next/link` — use `@/i18n/navigation`
- Use `console.log` — use `src/lib/logger.ts`
- Use `!` non-null assertions to suppress `noUncheckedIndexedAccess`
- Use `as any` in mocks — use `vi.mocked()`
- Add `'use client'` without concrete reason
- Use `parse()` in server actions — use `safeParse()`
- Throw from server actions — return `ActionResult`
- Hardcode user-facing strings — use translations
- Use raw `<img>` — use Next.js `<Image>`
- Use `useSearchParams` — use `nuqs`
- Modify `src/components/ui/` directly
- Add DB calls or heavy logic in middleware
- Create `index.ts` barrel files
- Run tests against production DB
- Use `formAction` or raw `fetch` for mutations — use server actions via `useTransition`
- Instantiate Stripe directly — use `getStripe()` from `src/server/stripe.ts`
- Use raw `router.push` — use `useNavigateWithTransition`
- Do manual coordinate/distance math — use `src/lib/geo-utils.ts`
- Format dates/prices directly — use `src/lib/i18n/formatters.ts`
- Store plaintext access tokens — hash before persisting

## Git Branching & Environments

### Protected Branches

- **`main`** — Production. Protected: requires PR, 1 approval, status checks must pass. No direct push.
- **`dev`** — Staging. Protected: requires PR, status checks must pass. No direct push.

### Environments

| Environment | Branch           | URL                     | Database (Neon)    | Stripe    |
| ----------- | ---------------- | ----------------------- | ------------------ | --------- |
| Dev local   | any              | `localhost:3000`        | Docker local       | test keys |
| Preview     | feature branches | auto Vercel URL         | Neon `preview`     | test keys |
| Staging     | `dev`            | `encave-dev.vercel.app` | Neon `development` | test keys |
| Production  | `main`           | `encave.ch`             | Neon `production`  | live keys |

### Git Workflow

```
feature branch → PR to dev → merge → PR from dev to main → merge → prod
```

1. Create feature branch from `dev`: `git checkout dev && git pull && git checkout -b samuel/enc-XX-slug`
2. Work, commit, push feature branch
3. Open PR targeting `dev` — triggers Preview deploy
4. Merge to `dev` — triggers Staging deploy on `encave-dev.vercel.app`
5. When staging is validated, open PR from `dev` to `main`
6. Merge to `main` — triggers Production deploy on `encave.ch`

**NEVER push directly to `main` or `dev`.** Always use PRs.

### Branch Naming

- **Format**: `samuel/enc-{number}-{slug}`
- **Example**: `samuel/enc-42-add-wine-listing-page`
- The branch name is auto-generated by Linear via `Cmd+Shift+.` on any issue
- The `ENC-XX` identifier is what links the branch/PR to the Linear issue

## Linear Integration

### PR ↔ Linear Issue Linking

PRs are automatically linked to Linear issues when:

1. The branch name contains the issue ID (e.g., `enc-42`)
2. The PR title contains the issue ID (e.g., `ENC-42: Add wine listing`)
3. The PR description uses a magic word (e.g., `Fixes ENC-42`)

**Preferred approach**: Always include `ENC-XX` in both the branch name AND the PR title.

### PR Workflow Automation (Linear)

| Event               | Linear Status |
| ------------------- | ------------- |
| PR opened           | → In Progress |
| Review requested    | → In Review   |
| PR merged to `main` | → Done        |

### Git Workflow for Claude Code Agents

When starting work on a Linear issue:

1. Get the branch name from Linear (format: `samuel/enc-XX-slug`)
2. Create feature branch from `dev`: `git checkout dev && git pull && git checkout -b samuel/enc-XX-slug`
3. Make commits with conventional format: `feat(enc-XX): description`
4. PR title must include: `ENC-XX: Description`
5. PR targets `dev` (not `main`)
6. PR description should include: `Fixes ENC-XX` for auto-close on merge
