# EnCave — Design System (Source of Truth / MASTER)

> Canonical reference for the UI/UX coherence audit. Generated from `src/app/globals.css`,
> `tailwind.config.ts`, the shadcn primitives (`button`, `badge`, `card`) and `CLAUDE.md`.
> "Coherence" = every component measured against THIS, not against a generic template.
> Auditors: measure each component against these tokens + the `ui-ux-pro-max` rule set.

---

## 1. Brand identity

Premium-décontracté Swiss wine-experience marketplace. Warm, editorial, calm. **Not** cold/techy.
Light mode is the product; `.dark` tokens exist but are "future use".

## 2. Color tokens (Tailwind)

**Always prefer semantic utilities over raw hex / cold grays.**

| Use | Canonical utility | Raw value |
|---|---|---|
| Page background | `bg-background` | `#fdfcfa` cream |
| Section background | `bg-muted` / `bg-secondary` / `bg-accent` | `#faf7f1` |
| Card / popover surface | `bg-card` / `bg-popover` | white |
| Brand / CTA | `bg-primary` (`hover:bg-[hsl(var(--primary-hover))]`) | burgundy `#962a48` → `#732040` |
| Brand tint | `bg-primary-light` | `#f2e9eb` |
| Body text | `text-foreground` | ink `#1a0f12` |
| Secondary/meta text | `text-muted-foreground` | `#915564` |
| Borders | `border-border` / `border-input` | `#e5d2d7` |
| Focus ring | `ring-primary` (global `:focus-visible` already set) | burgundy |

**Brand scales** (use intentionally, not raw hex): `burgundy-*`, `gold-*` (gold-400 `#dcc882`, gold-500 `#b8973e`), `cream-{50,100,200}`, `ink-{300,500,700,900}`, `stone-*`, `earth-*`, `vine-*`.

**Status:** use `<Badge variant="success|warning|destructive">` (emerald / amber / red) — or semantic `--success` / `--warning` / `--error`. Do **not** invent `green-*` / `yellow-*` ad-hoc status colors.

### Anti-patterns (coherence smells → flag)
- **Cold grays** `gray-*` / `slate-*` for text, borders or surfaces where a warm token exists (`ink-*`, `stone-*`, `cream-*`, `border`, `muted`). `slate`/`gray` are defined in config (won't break the build) but break the **warm brand** — flag as `tokens-color` / `major`.
- **Hardcoded hex** in `className`/`style` where a token exists.
- `text-slate-400` / `text-gray-400` as body/meta text (also a contrast smell).

## 3. Typography

- **Titres / display:** `font-display` = Nunito (sans, gros titres). **Serif / sous-titres:** `font-serif` = Averia Serif Libre. **Corps / UI:** `font-sans` = Mukta Vaani. **Numeric/mono:** `font-mono` = JetBrains Mono. ⚠️ `font-display` ≠ `font-serif` désormais (titre sans vs accent serif) — ne les traite plus comme interchangeables.
- **Custom type scale (prefer these):** `text-display-xl`, `text-display-lg`, `text-display-md`, `text-display-sm`, `text-body`, `text-meta` (uppercase tracking), `text-eyebrow` (uppercase tracking).
- Coherence: a component mixing many raw sizes (`text-2xl`, `text-[13px]`…) instead of the scale → `typography` / `minor`. Headings should use `font-display`/`font-serif`.

## 4. Spacing, radius, shadow, motion

- **Radius by element:** buttons/inputs `rounded-lg`, cards `rounded-xl`, badges/pills `rounded-full`. Random `rounded-md`/`rounded-2xl` mixing on the same element type → `spacing-layout` / `minor`.
- **Shadows:** use the warm named tokens — `shadow-card`, `shadow-card-hover`, `shadow-warm{,-sm,-md,-lg,-xl}`, `shadow-gold`, `shadow-primary`. Raw `shadow-md`/`shadow-lg` where a warm token fits → `minor`.
- **Motion:** micro-interactions 150–300ms; use `ease-premium` (`transition-all duration-200/300 ease-premium`). `prefers-reduced-motion` is handled globally in `globals.css` — do **not** re-implement. Durations >500ms or instant state changes on hover → `motion` / `minor`.

## 5. Canonical components (compose, don't re-implement)

| Need | Use | Smell |
|---|---|---|
| Button | `<Button variant size>` (`@/components/ui/button`) | raw `<button className="bg-primary …">` re-styling a button |
| Status pill | `<Badge variant>` (`@/components/ui/badge`) | bespoke `<span>` pill re-implementing badge styles |
| Card surface | `<Card>/<CardHeader>/…` | raw `<div className="rounded-xl border bg-card shadow-card">` |
| Empty state | `<EmptyState>` (`@/components/shared`) | hand-rolled empty UI |
| Spinner / loading | shared `LoadingSpinner` / skeleton (`.skeleton-warm`) | cold `animate-pulse bg-gray-200` |

> Known coherence debt to confirm: multiple status-badge implementations across zones
> (`booking/dashboard/BookingStatusBadge`, `event-detail/BookingStatusBadge`,
> `experience/StatusBadge`, `earnings/TransactionStatusBadge`), duplicate `ViewToggle`,
> duplicate `BookingsTable`, `LocationSection` duplicated. These are **report-only**
> (structural dedup = human decision), never auto-fixed.

## 6. Interaction & accessibility (ui-ux-pro-max — CRITICAL)

- **cursor-pointer** on every clickable non-`<button>`/`<a>` element (cards, custom toggles, role="button").
- **Hover feedback** on interactive elements (color/shadow/border — not layout-shifting scale).
- **Focus** visible (global ring exists; custom interactive elements must be focusable / `tabIndex`).
- **Touch targets** ≥ 44×44px for primary mobile actions (`size="sm"` = h-9/36px is borderline on mobile).
- **Icon-only buttons** need an accessible name (`aria-label`) — **must be translated** via `useTranslations`, never a hardcoded English string.
- **Images:** Next.js `<Image>` with meaningful `alt` (translated). No raw `<img>`.
- **Forms:** every input has an associated `<label htmlFor>` / shadcn `<Label>`. Errors near the field.
- **Color not the only signal** (status needs icon/text too).
- **Icons:** single set = `lucide-react`. No emoji as icons. Consistent sizing (`h-4 w-4` / `h-5 w-5`).

## 7. States & responsive

- Every data component: **loading / empty / populated** (+ error). Every route segment: `loading.tsx` + `error.tsx`.
- Mobile-first (`sm: md: lg:`). No horizontal scroll. Verify 375 / 768 / 1024 / 1440.

## 8. i18n / conventions (don't introduce violations when fixing)

- All user-facing strings via `useTranslations`/`getTranslations` (incl. aria-label, alt). 3 locales.
- Nav from `@/i18n/navigation` (never `next/navigation` or `next/link`). `@/` imports, no `../../`.

---

## Audit rubric

**Dimensions:** `tokens-color`, `typography`, `spacing-layout`, `component-variant`, `interaction`, `states`, `accessibility`, `responsive`, `iconography`, `motion`.

**Severity:**
- `blocker` — blocks/excludes users: contrast fail on body text, icon-only control with no accessible name, missing label on a real form field, missing meaningful `alt`, horizontal scroll on mobile.
- `major` — clear brand-token violation (cold gray / hardcoded hex for text-bg-border), missing focus/hover on interactive, missing loading/empty/error on a data component, sub-44px primary mobile action.
- `minor` — inconsistent radius/shadow/spacing token, raw size vs type scale, off-range transition.
- `cosmetic` — small polish.

**autoFixable = true ONLY for these safe kinds** (everything else is report-only):
- `token-swap` — replace a cold gray / hardcoded hex utility with the visually-equivalent warm semantic/brand token (e.g. `text-gray-500`→`text-muted-foreground`, `text-slate-900`→`text-foreground`, `border-gray-200`→`border-border`, `bg-gray-50`→`bg-muted`). Only when clearly equivalent; never change the visual intent.
- `cursor-pointer` — add `cursor-pointer` to a clickable non-button element that has `onClick` and lacks it.

**NEVER auto-fix** (report only): anything touching i18n (aria-label/alt text — needs a translation key), `<img>`→`<Image>`, component dedup/refactor, layout/spacing/max-width changes, structural JSX changes.
