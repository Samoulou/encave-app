# EnCave — UI/UX Coherence Audit (Full 18-Zone Report)

> Every component measured against [`MASTER.md`](./MASTER.md) (the design-system source of truth) and the `ui-ux-pro-max` rubric.
> Safe fixes (visually-equivalent token swaps, `cursor-pointer`) were auto-applied to the working tree; everything else is **report-only** (human decision).
> Audit date: 2026-06-19 · Branch: `dev`

---

## 1. Executive summary

The full audit covered **all 18 zones**, surfacing **558 confirmed findings**: **27 blockers, 316 major, 213 minor, 2 cosmetic**. **193 safe token-swaps were auto-applied**; the remaining **365 findings need a human decision**. The headline verdict: **the app's structure is sound but its visual identity is not coherently applied.** The warm Swiss-wine brand palette defined in `MASTER.md` is honored in tokens and `globals.css`, but is broken at the component layer across nearly every zone — most components were hand-built with cold Tailwind defaults (`slate-*`/`gray-*`) instead of the warm semantic tokens.

Five systemic patterns dominate and account for the overwhelming majority of findings:

1. **Pervasive cold-gray text (`slate-*` / `gray-*`) where warm tokens exist.** This is THE dominant finding class and appears in every single zone — admin, auth, calendar, experience, booking, checkout, search, home, layout, shared, public routes, and all six error boundaries. It is also the bulk of the auto-fixes (cold-gray → `text-foreground`/`text-muted-foreground` is the rubric's sanctioned safe swap).
2. **Ad-hoc raw status palettes (`green/red/amber/yellow/blue/emerald/orange-*`) instead of semantic `--success`/`--warning`/`--error` and `<Badge variant>`.** Recurs in admin stats, every status banner, every calendar "blocked" state, Stripe onboarding, payment status, and across the booking flow. Cold `blue` (`processing`) was even invented for a status with no warm slot. These are NOT pixel-equivalent swaps → report-only.
3. **Duplicate, bespoke status badges that re-implement `<Badge>` by hand.** At least six independent `StatusBadge`/`BookingStatusBadge` implementations exist (`booking/dashboard`, `event-detail`, `experience`, `booking-core` pills, plus the earnings `TransactionStatusBadge`), several carrying cold hex like COMPLETED `#1d4ed8` (blue) and NO_SHOW `#374151` (gray). This is the single biggest dedup opportunity (MASTER §5 known debt).
4. **Heavy i18n debt — hardcoded English AND hardcoded French both ship to the wrong locales.** The entire create/edit experience forms, the home editorial pages, the unsubscribe route, the experience-detail public page, and many aria-labels/alt-text are untranslated. Since French is the default locale, both English leaks (de/en pages) and French leaks (de/en) are real user-facing bugs. This is the largest non-auto-fixable theme and the source of all 27 blockers.
5. **Forbidden `next/link` / `next/navigation` imports** instead of `@/i18n/navigation`, dropping the locale prefix on navigation. Recurs in ~20 components across admin, experience, booking-dashboard, checkout, layout sidebars, shared, and public routes.

Rounding out the debt: **`bg-white` + raw `shadow-sm`/`shadow-lg` instead of `bg-card`/`bg-popover` + warm shadow tokens** on virtually every card/table/tooltip surface; **canonical-component bypasses** (hand-rolled cards, empty states, breadcrumbs, spinners, raw `<button>` re-styling `<Button>`); **arbitrary px typography/radii** in the home editorial layer instead of the display scale; and **missing per-segment `error.tsx`** across more than a dozen protected route segments.

**Coverage caveat:** the `layout-seo` zone audited only layout components — no SEO/metadata surfaces (`generateMetadata`, og/sitemap/robots) were examined. The `routes-protected` zone centered on route files (`page/loading/error/layout`) and did not deeply assess the heavy delegated client forms (`CreateExperienceForm`, `AvailabilityScheduleBuilder`, etc.), though `experience-forms` and `experience-core` later covered most of those. A handful of CLAUDE.md convention checks (`setRequestLocale`, console.\* logging) were retained as report-only but flagged as a loose fit for the visual-coherence rubric.

---

## 2. Per-zone coherence scorecard

| Zone                                  | Files    | Findings | Blocker |   Major |   Minor | Cosmetic | Auto-fixed | Grade |
| ------------------------------------- | -------- | -------- | ------: | ------: | ------: | -------: | ---------: | :---: |
| `earnings`                            | 7        | 29       |       0 |      16 |      13 |        0 |         11 | **D** |
| `misc` (dashboard visibility banners) | 4        | 10       |       0 |       0 |       9 |        1 |          1 | **C** |
| `routes-protected`                    | ~30      | 46       |       3 |      24 |      19 |        0 |         16 | **D** |
| `admin`                               | 7        | 25       |       0 |      17 |       8 |        0 |          6 | **D** |
| `auth-settings`                       | 6        | 29       |       0 |      14 |      15 |        0 |         14 | **D** |
| `booking-calendar`                    | 7        | 24       |       0 |      14 |      10 |        0 |          9 | **D** |
| `experience-core`                     | ~30      | 58       |       9 |      35 |      14 |        0 |         19 | **D** |
| `booking-dashboard`                   | 8        | 30       |       0 |      17 |      13 |        0 |          8 | **D** |
| `checkout-client`                     | 9        | 33       |       1 |      17 |      15 |        0 |          8 | **D** |
| `discovery`                           | 12       | 41       |       0 |      22 |      19 |        0 |         18 | **D** |
| `routes-public`                       | ~30      | 40       |       2 |      16 |      22 |        0 |          6 | **C** |
| `event-detail`                        | 14       | 28       |       1 |      18 |       9 |        0 |         12 | **D** |
| `experience-forms`                    | 6        | 28       |       2 |      20 |       6 |        0 |         15 | **D** |
| `layout-seo`                          | 9        | 17       |       4 |      13 |       0 |        0 |          7 | **D** |
| `shared`                              | 24       | 32       |       1 |      26 |       5 |        0 |         15 | **D** |
| `routes-rest`                         | 26       | 44       |       2 |      19 |      23 |        0 |         14 | **C** |
| `booking-core`                        | 17       | 16       |       2 |       9 |       4 |        1 |          4 | **C** |
| `winery`                              | 15       | 28       |       0 |      19 |       9 |        0 |         11 | **D** |
| **Total (18 of 18 zones)**            | **~268** | **558**  |  **27** | **316** | **213** |    **2** |    **193** |   —   |

**Grading basis** (finding density × severity):

- **Grade D (13 zones)** — high density (≥2.5 findings/file _or_ a large absolute count) **and** a heavy major/blocker load. The warm brand is broken on essentially every surface, with cold-gray text, ad-hoc status palettes, bespoke badges, hand-rolled components, and (in the experience/forms zones) blocking i18n gaps. `experience-core` (58 findings, 9 blockers) and `routes-protected` (46 findings, 3 blockers) are the worst offenders by absolute volume; `layout-seo` and `shared` earn D on severity (proportionally heavy majors/blockers in app-wide components that propagate everywhere).
- **Grade C (4 zones)** — real but narrower debt. `routes-public` and `routes-rest` are dominated by minors (route-state/convention checks, localized skeleton labels) with a manageable major count. `booking-core` has the lowest absolute count (16) and is mostly clean token-swaps plus a few badge dedups. `misc` is a single coherent pattern (the `VisibilityBanner` family) with zero majors.
- **No zone earned A or B.** Every zone shipped the cold-gray pattern; the best-tokenized references found were `CookieConsentBanner` (shared) and the checkout components (vs. the newer `ClientBookingsTabs`), which point to what "good" looks like.

### Findings dropped during verification (not counted above)

Across the 16 new zones, **20 findings were rejected** during re-verification (self-contradictory, misclassified, false-positive, or out-of-rubric): notably the `border-stone-200` "violations" (stone is a _sanctioned_ warm scale, byte-identical to `--border`), several native-`<button>` `cursor-pointer` flags (the rubric exempts native buttons), `setRequestLocale`-only findings filed under the wrong dimension, and `console.error` findings (a logging-contract, not a visual-coherence, concern). One `misc`-zone finding (`ExportEarningsButton.tsx:34` `useSearchParams`) was likewise tracked separately. Confirmed totals above exclude all rejections.

---

## 3. Auto-fixed (already applied)

**193 visually-equivalent token-swaps were applied to the working tree** (12 from the prior pass + 181 from the 16 new zones). All are pure color-token swaps the rubric explicitly enumerates — cold `slate-*`/`gray-*` text → `text-foreground`/`text-muted-foreground`, hardcoded `#915564` → `text-muted-foreground` (byte-exact match), `#fdfcfa` → `bg-background`, cold `bg-slate-*`/`bg-gray-50` surfaces → `bg-muted`, cold borders → `border-border`/`border-input`, plus a handful of brand-equivalent swaps (`text-white` on `bg-primary` → `text-primary-foreground`, `fill-yellow-500` star → `fill-gold-500`, cold slate chip → `stone-*`). **No shadow-geometry swaps, no semantic-status recolors, no structural/JSX/i18n changes were auto-applied.** Please review the git diff before committing.

```bash
git --no-pager diff
```

### Representative auto-fixes by zone (full list in source data)

| Zone              | File                                                                                           | Change                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| earnings          | `EarningsChart.tsx:44,90,97,101`                                                               | `text-[#915564]` → `text-muted-foreground`                                                  |
| earnings          | `EarningsSummaryCards.tsx` (6×)                                                                | `text-[#915564]` → `text-muted-foreground` (replace_all)                                    |
| earnings          | `TransactionTable.tsx:63,97,109`                                                               | `bg-gray-50`/`text-[#915564]`/`bg-gray-200` → `bg-muted`/`text-muted-foreground`/`bg-muted` |
| misc              | `VisibilityBannerSkeleton.tsx:13`                                                              | `bg-white` → `bg-card`                                                                      |
| routes-protected  | 6 identical `error.tsx` files                                                                  | `text-slate-900/600/400` → `text-foreground`/`text-muted-foreground`                        |
| routes-protected  | `settings/page.tsx`                                                                            | icon/badge surfaces `bg-slate-100`→`bg-muted`; all card text → warm                         |
| routes-protected  | `onboarding/winery/confirmation/page.tsx`                                                      | all slate heading/step text → warm tokens                                                   |
| admin             | `PendingWineriesTable.tsx`                                                                     | table head/name/commune/email/icon slate-\* → warm                                          |
| admin             | `WineryInfoPanel.tsx:105`                                                                      | applicant chip `bg-slate-100`/`text-slate-600` → `bg-stone-100`/`text-stone-600`            |
| auth-settings     | `LoginForm.tsx` / `RegisterForm.tsx`                                                           | heading/labels/placeholders/icons slate-\* + `text-[#915564]` → warm                        |
| auth-settings     | `NotificationPreferencesForm.tsx` (3×)                                                         | card `border-slate-200` → `border-border`                                                   |
| booking-calendar  | `CalendarView.tsx` / `WeekView.tsx` / `DayDetailPanel.tsx`                                     | grid/header/cell/meta slate-\* → `bg-muted`/`text-muted-foreground`/`text-foreground`       |
| booking-calendar  | `ViewToggle.tsx:20,27,39`                                                                      | track `bg-[#f8f6f6]`→`bg-muted`; labels `text-[#915564]`→`text-muted-foreground`            |
| experience-core   | `AddressAutocomplete.tsx`                                                                      | `bg-slate-50`→`bg-muted`, slate text → warm, `text-red-600`→`text-destructive`              |
| experience-core   | `ExperienceDetailHeader.tsx:43`                                                                | star `fill-yellow-500 text-yellow-500` → `fill-gold-500 text-gold-500`                      |
| experience-core   | `ExperienceCard.tsx` / `EditExperienceForm.tsx` / `CreateExperienceForm.tsx`                   | enumerated slate-_/gray-_ → warm tokens                                                     |
| booking-dashboard | `BookingsTable.tsx` / `BookingSummaryCards.tsx`                                                | `text-[#915564]` (19×) → `text-muted-foreground` (replace_all)                              |
| booking-dashboard | `BookingFilters.tsx:107`                                                                       | badge `text-white` → `text-primary-foreground` (on `bg-primary`)                            |
| checkout-client   | `OrderSummary.tsx` / `ClientBookingCard.tsx`                                                   | `text-[#915564]` (19×) → `text-muted-foreground`                                            |
| checkout-client   | `ClientBookingCard.tsx:264`                                                                    | refund box `bg-[#fdfcfa]` → `bg-background` (exact match)                                   |
| discovery         | `search/*` (Location/SearchBar/Filters/Results)                                                | every meta/icon `slate-*` → warm (16 swaps)                                                 |
| discovery         | `InteractiveMap.tsx:202`                                                                       | control button `text-slate-700` → `text-foreground`                                         |
| routes-public     | `about` / `booking/[id]` / `cepages` / `degustation` / `error.tsx`                             | slate text → `text-foreground`/`text-ink-700`/`text-muted-foreground`                       |
| event-detail      | `BookingRow*` / `SessionCard` / `EventDetailHeader`                                            | card/border/text slate-\* → warm; NO_SHOW pill → `bg-muted`                                 |
| experience-forms  | 5 `form-sections/*`                                                                            | labels/inputs/surfaces slate-\* → warm; selected `text-white`→`text-primary-foreground`     |
| layout-seo        | `ClientDashboardSidebar` / `DashboardSidebar` / `NavLink`                                      | inactive nav `gray-*`/`slate-600` → `text-muted-foreground`/`bg-muted`                      |
| shared            | `Breadcrumb` / `EmptyState` / `FaqAccordion` / `ImageUpload` / `LoadingSpinner` / `Pagination` | slate text/surface → warm (app-wide impact)                                                 |
| routes-rest       | admin pages + `error.tsx` + `not-found` + `unsubscribe` + `coming-soon`                        | slate-\* text/bg → warm tokens                                                              |
| booking-core      | `BookingDatePicker` / `CancellationModal` / `GuestCountInput`                                  | slate meta/disabled text → `text-muted-foreground`; separator → `text-border`               |
| winery            | `PaymentStatus` / `StripeOnboarding` / `ViewToggle` / `WineryCard` / `WineryMediaSection`      | slate text/surface → warm tokens                                                            |

---

## 4. Report-only — needs a human decision

365 findings grouped by theme; sorted **blocker → major → minor** within each theme. Each item is `file:line — issue — proposed fix`. Representative/highest-impact findings are listed; the complete enumeration lives in the audit source data.

### 4a. Accessibility (i18n aria/alt, missing labels, non-color signals)

> Never auto-fixed — accessible names/alt need translation keys; structure changes are non-trivial. All 27 blockers live here.

**Blockers — controls with no accessible name / fully untranslated user-facing routes:**

- `src/app/[locale]/admin/bookings/page.tsx:100` — **blocker** — native `select` (status) + search `Input` have no label/aria-label (no accessible name). → add `<Label htmlFor>` or translated `aria-label`.
- `src/app/[locale]/admin/events/page.tsx:92,102` — **blocker** — two native selects + search input have no accessible name. → translated labels/aria-labels.
- `src/components/features/experience/AddressAutocomplete.tsx:263` — **blocker** — hardcoded English no-results/error/placeholder bypass `useTranslations`; breaks fr/de. → route through translations.
- `src/components/features/experience/BookingWidget.tsx:213` — **blocker** — hardcoded **French** UI strings (Choisissez un jour, Horaire, …) break de/en. → `useTranslations` keys in all 3 locales.
- `src/components/features/experience/CreateExperienceForm.tsx:4` & `EditExperienceForm.tsx:254` — **blocker** — entire create/edit forms hardcoded English (titles, labels, placeholders, toasts). → wire to `useTranslations`.
- `src/components/features/experience/CreateExperienceCard.tsx:28` — **blocker** — hardcoded English title/subtitle. → translations.
- `src/components/features/experience/ExperienceDetailActions.tsx:33` — **blocker** — hardcoded French (Lien copié/Partager/Enregistrer). → translations.
- `src/components/features/experience/ExperienceManagementCard.tsx:300` — **blocker** — hardcoded French 'Inscrits' on primary CTA. → `t()` key.
- `src/components/features/experience/ExperienceHero.tsx:14` — **blocker** — hardcoded English `TYPE_LABELS` + 'per person'. → `getTranslations`.
- `src/components/features/experience/TimeSlotEditor.tsx:52` — **blocker** — hardcoded English validation errors + aria-labels. → translations.
- `src/components/features/checkout/.../ClientBookingCard.tsx:244` — **blocker** — hand-rolled cancel modal: no `role="dialog"`/`aria-modal`, no focus trap, no Esc, hardcoded English `aria-label="Close"`. → use shadcn `Dialog`; translate label.
- `src/app/[locale]/(protected)/dashboard/settings/notifications/page.tsx:42` — **blocker** — entire section hardcoded English. → `getTranslations`.
- `src/app/[locale]/(protected)/onboarding/winery/page.tsx:60` — **blocker** — onboarding flow hardcoded English (back link, step, hero). → translations.
- `src/app/[locale]/(protected)/dashboard/scan/error.tsx:8` — **blocker** — error screen hardcoded **French**; en/de users get French. → `useTranslations`.
- `src/app/[locale]/(public)/booking/[id]/confirmation/layout.tsx:24` — **blocker** — logo link hardcoded English `aria-label`. → `t('goToHomepage')`.
- `src/app/[locale]/(public)/experiences/[slug]/page.tsx:56` — **blocker** — entire experience-detail page hardcoded French. → `getTranslations` + `setRequestLocale`.
- `src/components/features/experience/form-sections/MediaSection.tsx:82` & `AvailabilitySection.tsx:83,135` — **blocker** — icon-only delete buttons with hardcoded English `aria-label`. → translated keys.
- `src/components/layout/ClientDashboardSidebar.tsx:91` & `DashboardSidebar.tsx:111` — **blocker** — logo link + "Dashboard navigation" hardcoded English aria-labels. → translated keys.
- `src/components/layout/HeaderSearchPill.tsx:9` & `MobileBackButton.tsx:22` — **blocker** — hardcoded **French** aria-labels. → translated keys.
- `src/components/shared/ImageUpload.tsx:104` — **blocker** — app-wide shared upload: aria-label + all copy hardcoded English. → translations.
- `src/components/features/booking/CancellationModal.tsx:206` — **blocker** — cancel label derived by string-matching the French translation; German users get English 'Cancel'. → dedicated `tCommon('cancel')` key.
- `src/components/features/booking/TimeSlotSelector.tsx:139` — **blocker** — 'Retry' + error fallback hardcoded English (`common.retry` absent in all locales). → add key.

**Major — untranslated strings/aria/alt and color-only signals (selected):**

- `src/components/features/admin/AdminStats.tsx:49` & `AdminSuspensionControls.tsx:41,94` — **major** — components have zero `useTranslations`; every label/toast/placeholder hardcoded English; suspension `Textarea` also has no associated `<Label>`. → translate + add label.
- `src/components/features/booking/calendar/ExperienceTypeDot.tsx:36` & `WeekView.tsx:203,218` — **major** — hardcoded English type labels + `aria-label` (and 'g' suffix). → `useTranslations`.
- `src/components/features/home/HomeDesktopEditorial.tsx:116` & `HomeMobileEditorial.tsx:210` & `HomeSearchPanel.tsx:65` — **major** — entire home editorial layer hardcoded French copy + alt + aria-labels. → `getTranslations`/`useTranslations`.
- `src/components/features/search/SearchResults.tsx:169` — **major** — pagination aria-labels hardcoded English. → translations.
- `src/app/[locale]/unsubscribe/page.tsx:48` — **major** — public route 100% hardcoded English. → `getTranslations`.
- `src/components/shared/SkipLink.tsx:13` & `VerifiedBadge.tsx:36` & `LoadingSpinner.tsx:29` & `NotFoundSearch.tsx:4` & `Breadcrumb.tsx:60` & `NavigationLoader.tsx:4` — **major** — app-wide shared components ship hardcoded English strings/aria/sr-only labels. → translations.
- `src/components/features/discovery/map/InteractiveMap.tsx:381` — **major** — popup injects raw `<img>` via `innerHTML` (see Images theme).
- `src/components/features/experience/EarningsChart.tsx:94` (earnings) — **minor** — two area series distinguished by **color only**. → add `strokeDasharray`/markers or an accessible data table.

### 4b. Component duplication / dedup

> Structural refactors — never auto-fixed (MASTER §5/§6). The dominant cross-zone debt is the duplicate status badge.

- **Duplicate status badges (cross-zone, MASTER §5 known debt) — major:**
  - `src/components/features/booking/dashboard/BookingStatusBadge.tsx:11,50` — bespoke `<span>` with hardcoded hex; COMPLETED cold-blue `#1d4ed8`, NO_SHOW cold-gray `#374151`.
  - `src/components/features/event-detail/BookingStatusBadge.tsx:46` — bespoke `<span>` re-implementing `<Badge>`.
  - `src/components/features/experience/StatusBadge.tsx:11` — bespoke pill, cold DRAFT gray + ad-hoc green/amber + hardcoded English labels.
  - `src/components/features/booking/GuestCountInput.tsx:143` & `confirmation/BookingReferenceHeader.tsx:26` — bespoke pills (orange/green) where `<Badge variant>` exists.
  - `src/components/features/admin/WineryVerificationPanel.tsx:40` — bespoke status pill with ad-hoc amber/green/red + raw enum text.
  - `src/components/features/earnings/TransactionStatusBadge.tsx:36` — bespoke pill (already MASTER §6 debt).
  - → **Consolidate all onto one canonical `<Badge variant="success|warning|destructive|secondary">`** with a warm neutral for NO_SHOW/DRAFT.
- `src/components/layout/ClientDashboardSidebar.tsx` ↔ `DashboardSidebar.tsx` — **major** — near-duplicate twins (same structure, same `#e5dbdd`/`#f8f6f6` hex, same untranslated aria, same `next/link`). → extract a shared sidebar; any fix must hit both.
- Six structurally identical `error.tsx` components (`routes-protected`) — **minor** — `src/app/[locale]/(protected)/error.tsx:5` and the 5 dashboard siblings. → extract a shared `ErrorState` in `@/components/shared`.
- Hand-rolled empty states instead of `<EmptyState>` — **minor** — `admin/PendingWineriesTable.tsx:97`, `booking/dashboard/BookingsEmptyState.tsx:11`, `checkout/.../ClientBookingEmptyState.tsx:11`, `search/SearchResults.tsx:251`, `event-detail/BookingsTable.tsx:19`. → compose `@/components/shared/EmptyState`.
- Raw `<button>` re-styling `<Button>` — **minor** — `booking/dashboard/ExportCSVButton.tsx:65`, `BookingFilters.tsx:98`, `BookingsTable.tsx:286`, `admin/AdminSuspensionControls.tsx:68`, plus `<Link>`-styled-as-button across checkout/empty-state CTAs. → `<Button variant>` / `<Button asChild>`.
- Bespoke spinners instead of shared `LoadingSpinner`/Button `isLoading` — **minor** — `winery/WineryProfileForm.tsx:243`, `settings/NotificationPreferencesForm.tsx:169`.
- Forbidden `next/link`/`next/navigation` (locale-prefix dropped) — **major** — `admin/{AdminSuspensionControls,WineryDetailView,PendingWineriesTable}`, `experience/{BookingWidget,EditExperienceForm,ExperienceFilters,ExperiencesPagination,ExperienceManagementCard,MobileBookingDrawer,CreateExperienceCard,ExperienceDetailHeader}`, `booking/dashboard/{ExportCSVButton,BookingsTable,BookingsEmptyState}`, `checkout/.../{ClientBookingCard,ClientBookingsPage}`, `layout/{ClientDashboardSidebar,DashboardSidebar}`, `shared/{Breadcrumb,NavigationLoader,NotFoundSearch}`, `winery/{WineryAccessGuard,WineryOnboardingForm,WineryProfileForm}`, `booking/{CancellationModal,confirmation/ModifyBookingCard}`, and most `routes-public`/`routes-rest` pages. → import from `@/i18n/navigation`.

### 4c. Status / brand color tokens (ad-hoc palettes → semantic)

> Not safe token-swaps: semantic status tokens are NOT pixel-equivalent to raw palette scales (`--error` is darker/more saturated than `red-600`; `bg-red-50/40` opacity has no direct semantic equivalent; cold `blue` has no warm slot). Design decision — report-only.

- **Calendar "blocked" state ad-hoc red** — major — `booking/calendar/CalendarView.tsx:144`, `DayDetailPanel.tsx:123`, `WeekView.tsx:143`. → `bg-destructive/10 text-destructive` or `<Badge variant="destructive">`.
- **Admin/dashboard ad-hoc status colors** — major — `admin/AdminStats.tsx:58` (green/amber/red cards), `PendingWineriesTable.tsx:99` (green chip), `WineryActionsPanel.tsx:66,151` (emerald/red buttons), `WineryInfoPanel.tsx:138` (green verified block), `admin/page.tsx:112` (green icon).
- **Notification/settings icon chips** — major — `settings/NotificationPreferencesForm.tsx:77` (blue/green/amber chips clash with burgundy/gold/cream). → warm brand tints.
- **Auth error banners** — major — `auth/LoginForm.tsx:136` & `RegisterForm.tsx:122` (`bg-red-50`/`text-red-600`). → `bg-destructive/10 text-destructive` (verify; not pixel-equal). Duplicated → shared error-banner component.
- **Winery/Stripe status** — major — `winery/PaymentStatus.tsx:44`, `StripeCallbackResult.tsx:50`, `WineryAccessGuard.tsx:78` (yellow/orange pending). → semantic `--success`/`--warning`.
- **Booking flow status** — major — `booking/CancellationModal.tsx:129` (green refund banner), `GuestCountInput.tsx:143` (orange low-capacity), `confirmation/BookingReferenceHeader.tsx:26` (green pill), `CancelBookingButton.tsx:28` (raw red). → `<Badge variant>` / `variant="destructive"`.
- **VisibilityBanner family** (misc) — minor — `VisibilityBannerError.tsx:42,46`, `VisibilityBannerPartial.tsx:81,84,120,146`, `VisibilityBannerSuccess.tsx:24,27` — raw red/amber/emerald surfaces + icons. → tokenized status surfaces.
- **Earnings** — major — `EarningsSummaryCards.tsx:60,107` (green/red trend, yellow pending), `TransactionStatusBadge.tsx:37,44,52` (green/cold-blue/yellow; **blue `processing` has no warm slot** — re-map to warning or `bg-primary-light`).
- **Public/rest routes** — major/minor — `booking/[id]/confirmation/layout.tsx:35` (green pill), `confirmation/page.tsx:153` (yellow pending), `booking/[id]/page.tsx:71` (rainbow status), `coming-soon/page.tsx:27` (rainbow chips), `[locale]/error.tsx:28` & `admin/error.tsx:26` (raw red icon), `unsubscribe/page.tsx:44` (green/amber/red icons).
- **Off-brand cold hexes** — minor — `auth/AuthPageLayout.tsx:47` (`from-slate-900/80` gradient), `discovery/map/InteractiveMap.tsx:176` (`#4f46e5` indigo locate marker — use burgundy/gold), `EarningsChart.tsx:100` (`#9ca3af` cold-gray net-payout series — use `gold-500`).

### 4d. Layout / spacing (radii, shadows, touch targets)

- **Raw shadows instead of warm tokens** — minor — recurs on nearly every card/table/tooltip: `booking/dashboard/BookingsTable.tsx:104` & `BookingSummaryCards.tsx:30` (`shadow-sm`→`shadow-card`), `checkout/{ContactDetailsSection,MobileOrderSummary,OrderSummary,ClientProfileForm}` (`shadow-sm`/`shadow-lg`→`shadow-card`), `experience-forms/*` section wrappers (`bg-white`+`shadow-sm`→`bg-card`+`shadow-card`), `event-detail/SessionCard.tsx:63`, `admin/PendingWineriesTable.tsx:58`, `shared/{SuccessCheckmark:92,CookieConsentBanner:63}`, `winery/WineryMediaSection.tsx:197`, `home/{HeroSearchBar,HomeSearchPanel,HowItWorks}`. → warm named shadow tokens (verify geometry).
- **Arbitrary radii vs the radius scale** — minor — `experience/BookingWidget.tsx:190` (`rounded-[18px]`), `checkout/.../ClientBookingsTabs.tsx:138` (`rounded-[16px/18px/22px]`), `home/HomeDesktopEditorial.tsx:186` (`rounded-[14px/18px]`), `booking/TimeSlotSelector.tsx:170` (`rounded-[10px]`), pill `rounded-md` on `ViewToggle`/`StatusBadge`/`AvailabilityPreview`. → `rounded-lg` (buttons/inputs), `rounded-xl` (cards), `rounded-full` (pills).
- **Touch targets < 44px** — minor — `auth/UserMenu.tsx:134` (h-9 w-9 avatar), `shared/Pagination.tsx:78` (h-8 controls), `event-detail/BookingActionsSheet.tsx:139` (h-9 mobile trigger), `home/HomeMobileEditorial.tsx:210` (h-9 favorites). → ≥44px on mobile.
- **Hover-only / layout-shifting affordances** — minor — `experience-forms/AvailabilitySection.tsx:126` (edit/delete `opacity-0` → unreachable on touch), `checkout/TrustBadges.tsx:9` (permanent `opacity-50`), `shared/ImageUpload.tsx:111` (`hover:scale-105`), `home/HowItWorks.tsx:49` (`scale-110`), `coming-soon/page.tsx:231` (`-translate-y-1`). → reveal on `focus-within`; prefer color/shadow over scale.
- **Mobile horizontal scroll** — minor — `booking/calendar/WeekView.tsx:124` (forced 800px min-width). → mobile-adapted day view below `md:`.
- **Conflicting/dead utilities** — minor — `auth/AuthPageLayout.tsx:83` (`lg:w-1/2` + `lg:w-[45%]`), `misc/VisibilityBannerPartial.tsx:110` (dead ternary, both branches identical — cosmetic).

### 4e. Typography scale

- **Raw sizes instead of the display/type scale** — minor — `admin/AdminStats.tsx:32` (`text-4xl`) & `WineryVerificationPanel.tsx:32` (`text-2xl`), `booking/calendar/CalendarNavigation.tsx:72` (sans heading, no `font-display`), `experience/{AboutSection:17,ExperienceHero:69}`, `event-detail/EventDetailHeader.tsx:58`, `booking-dashboard/BookingSummaryCards.tsx:38`, `checkout/{OrderSummary:79,ClientBookingsPage:34}`, `experience-forms/SectionHeader.tsx:12` (**root cause** — every form heading misses Fraunces; fix once, fixes the zone), `home/HomeDesktopEditorial.tsx:116` (`text-[80px]`/`[34px]`/etc.), public `experiences/[slug]/page.tsx:187`. → `font-display` + `text-display-*` scale.
- **Raw date/currency formatting (localization)** — minor — `earnings/EarningsSummaryCards.tsx:119` & `TransactionTable.tsx:93` (`date-fns format()`), `checkout/.../ClientBookingsTabs.tsx:113` & `event-detail/ContactGuestsButton.tsx:34` (`new Intl.DateTimeFormat`), `booking/dashboard/ClientDetailsModal.tsx:135` (hand-rolled CHF), `admin/events/page.tsx:141` (`price/100` + raw duration), public `booking/[id]/page.tsx:168` (`format('EEEE, MMMM d, yyyy')`), `experiences/[slug]/page.tsx:417` (local `formatDuration`). → `formatDate`/`formatCHF`/`formatDuration` from `@/lib/i18n/formatters` & `@/lib/utils/currency`.

### 4f. Images (`<img>` → `<Image>`)

- `src/components/features/discovery/map/InteractiveMap.tsx:381` — **major** — popup cover photo injected as raw `<img>` via `innerHTML`. → render popup via React portal/component so it can use `next/image`, or document as an accepted exception.
- `src/app/coming-soon/page.tsx:119,340` — **minor** — external `images.unsplash.com` via inline `bg-[url(...)]`; bypasses optimization + needs CSP review. → self-host under `/public` or Vercel Blob.
- `src/components/features/earnings/TransactionTable.tsx:107` — **minor** — customer avatar as CSS background-image div. → `<Image>`.

### 4g. Route states (loading/empty/error per segment)

> CLAUDE.md per-segment rule; loose fit for the visual rubric but real convention debt.

- **Missing `error.tsx`** — major/minor — endemic in `routes-protected`: `experiences/[id]/edit`, `experiences/new`, `my-bookings`, `profile`, `settings`, `settings/notifications`, `stripe/callback`, `winery/profile`, `onboarding/winery`, `onboarding/winery/confirmation`, `experiences/[id]/preview`. Also `(auth)` group and `/coming-soon` (no boundary at all). → add scoped `error.tsx`.
- **Missing/mismatched `loading.tsx`** — major/minor — public `wineries/[slug]/page.tsx:45` (inherits a directory-grid skeleton, not detail), `experiences/[id]/preview/loading.tsx:3` (generic spinner vs rich page skeleton).
- **Missing empty states** — minor — `admin/bookings/page.tsx:131` & `admin/events/page.tsx:133` (blank card when zero results). → render `<EmptyState>`.
- **Localized skeleton labels** — minor — `experiences/loading.tsx:11` (French), `wineries/loading.tsx:11` (French), `experiences/page.tsx:138` (English) sr-only labels. → translate.
- **`setRequestLocale` omitted** — minor (convention) — most public/admin server pages + `admin/layout.tsx`. → call after awaiting params.

---

## 5. Recommended next steps

### Quick wins (low-risk, high-coverage — do first)

1. **Land the 193 auto-fixes.** Review the full `git diff` and commit — these are pure equivalent token swaps with no intended visual change (cold-gray → warm semantic across every zone). This alone resolves the single biggest finding class.
2. **Finish the `#915564` / cold-gray sweep.** Grep the whole repo for `text-[#915564]` (and `/50` variants), `text-slate-*`, `text-gray-*`, `bg-slate-*`, `bg-gray-50`, `border-slate-*` in `className`s outside the auto-fixed files and apply the same warm swaps. This is the highest-leverage mechanical change remaining.
3. **Localize the date/currency leaks** — swap raw `date-fns format()`, `new Intl.DateTimeFormat`, and hand-rolled CHF for `formatDate`/`formatCHF`/`formatDuration`. Small, self-contained, fixes real fr/de bugs (§4e).
4. **Surface swaps** (`bg-white`→`bg-card`/`bg-popover`, raw shadows → warm tokens) across the §4d list — mechanical, but verify shadow geometry visually since those aren't pixel-equivalent.
5. **Fix `SectionHeader.tsx:12` once** — adding `font-display` + a display-scale size fixes every experience-form heading at the root.
6. **Collapse dead utilities** — `VisibilityBannerPartial.tsx:110` ternary, `AuthPageLayout.tsx:83` conflicting widths.

### High-priority blockers (schedule immediately)

7. **i18n the create/edit experience forms, home editorial pages, the unsubscribe route, and the public experience-detail page** — these are the 27 blockers and the largest user-facing defect class (wrong-language content shipping to de/en/fr). Requires translation keys in all 3 locales + `npm run i18n:check`.
8. **Add accessible names** to the admin filter selects/search inputs and the suspension `Textarea` (`§4a` blockers) and replace the hand-rolled cancel modal in `ClientBookingCard` with shadcn `Dialog`.

### Structural refactors worth a dedicated PR

- **PR A — Badge consolidation (MASTER §5 known debt).** Replace ALL bespoke status badges (`booking/dashboard/BookingStatusBadge`, `event-detail/BookingStatusBadge`, `experience/StatusBadge`, `booking-core` pills in `GuestCountInput`/`BookingReferenceHeader`, `admin/WineryVerificationPanel`, earnings `TransactionStatusBadge`) with one canonical `<Badge variant>` mapping + a warm neutral for NO_SHOW/DRAFT. Single biggest cross-zone coherence win.
- **PR B — Tokenize the status system.** Introduce one tokenized status-surface helper keyed off `--success`/`--warning`/`--error` and migrate every ad-hoc `green/amber/red/blue/emerald/orange` instance (§4c) — calendar blocked states, admin/dashboard cards, auth/visibility banners, winery/Stripe, booking flow. Resolve the invented cold-`blue` `processing` here (no `info` slot exists — pick warning or a primary tint).
- **PR C — Navigation-import sweep.** Replace every `next/link`/`next/navigation` import with `@/i18n/navigation` (and `useSearchParams`→`nuqs`) across the ~20 affected components; drop the now-redundant manual `/${locale}` prefixing.
- **PR D — Sidebar dedup.** Merge `ClientDashboardSidebar` ↔ `DashboardSidebar` into one shared component; fixes the duplicated cold hex + untranslated aria in one place.
- **PR E — Shared error/empty-state pass.** Extract one `ErrorState` (the six identical `error.tsx` files) and route all hand-rolled empty UIs through `<EmptyState>`.
- **Carry-over (MASTER §5/§6):** `ViewToggle`, `BookingsTable`, and `LocationSection` duplications — fold into PRs A/C where they overlap (`ViewToggle` exists in both `booking/calendar` and `winery`; `LocationSection`/`WineryInfoCard` share the duplicated `', Valais'` geo-literal that wants a shared helper/translation key).

### Track separately (outside this rubric)

- `console.error` in error boundaries (`routes-protected` error files, `auth/RegisterForm:96`, `admin/error.tsx:20`, public `error.tsx:21`) → use `logError`/Sentry.
- `ExportEarningsButton.tsx:34` `useSearchParams` from `next/navigation` → `nuqs` convention ticket.
- Raw `<form action>`/`window.location` mutations (`admin/layout.tsx:100` sign-out, `BookingsTable.tsx:260`) → server action via `useTransition`.

### Coverage to close

- **SEO half of `layout-seo` is unaudited** — no `generateMetadata`/og/sitemap/robots/structured-data review. Schedule a metadata-coherence pass.
- **`routes-protected` delegated forms** — re-confirm the heavy client forms are fully covered by the later `experience-forms`/`experience-core` passes; spot-check `AvailabilityScheduleBuilder` and `ClientBookingsPage` wiring.
- **`ClientBookingsTabs.tsx`** (new/untracked) introduced a _second_ visual language (`ink-*`/`burgundy-*` raw scales + arbitrary px radii vs. checkout's warm semantic tokens) — needs a human design-direction decision before it spreads.
