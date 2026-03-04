# Design Review Results: Full Application (EnCave)

**Review Date**: 2026-02-27
**Routes Reviewed**: `/`, `/experiences`, `/experiences/[slug]`, `/login`, `/register`, `/about`, `/wineries`, `/dashboard`, `/admin`, `/booking`
**Focus Areas**: Visual Design, UX/Usability, Responsive/Mobile, Micro-interactions/Motion, Consistency

## Summary

EnCave is a well-crafted wine experience booking platform with a strong premium brand identity — warm burgundy/gold palette, Fraunces display font, and thoughtful micro-interactions. However, the review uncovered **24 issues** across several pages: critical hydration errors on the home page, inconsistent card component patterns, missing mobile-specific optimizations, hardcoded color values bypassing the design token system, and a few UX patterns that could be improved for conversion and clarity.

## Issues

| # | Issue | Criticality | Category | Location |
|---|-------|-------------|----------|----------|
| 1 | **Hydration mismatch on home page**: JsonLd component renders `<script type="text/javascript">` on server but `<script type="application/ld+json">` on client, causing React hydration errors. This triggers a full client-side re-render, degrading FCP/LCP and causing visible UI flicker. | 🔴 Critical | Consistency | `src/components/shared/JsonLd.tsx` |
| 2 | **CSP blocks auth session request**: `better-auth` client is trying to fetch `http://localhost:3000/api/auth/get-session` but the CSP `connect-src` directive only allows `'self'` (port 3001). This prevents auth state detection on the client and would break session-dependent UI. In production the port mismatch won't exist, but locally it creates a broken experience for development. | 🔴 Critical | UX/Usability | `next.config.js:10-17` |
| 3 | **Hero banner image fails to load**: The hero image at `/images/herobanner-image.jpg` returns `ERR_ABORTED`, leaving a blurred/empty hero section on first load. This is the most prominent section of the landing page. Verify the file exists in `public/images/`. | 🔴 Critical | Visual Design | `src/app/[locale]/page.tsx:79-87` |
| 4 | **Hero section content outside landmarks**: The `<h1>`, hero subtitle `<p>`, and background overlay `<div>` are not contained within any ARIA landmark region. The hero `<section>` element sits above the `<main>` landmark. Screen readers cannot navigate to this content via landmark shortcuts. Wrap the hero in `<main>` or give it `role="banner"`. | 🟠 High | UX/Usability | `src/app/[locale]/page.tsx:69-105` |
| 5 | **Inconsistent experience card design between Home and Experiences pages**: The home page uses `PopularExperiences` cards with a link-wrapped card pattern, while the `/experiences` listing page uses a different card component with separate winery name, location, duration, group size, and price layout. Card dimensions, badge placement, hover effects, and typography differ. Users may not recognize them as the same entity. | 🟠 High | Consistency | `src/components/features/home/PopularExperiences.tsx` vs experiences listing |
| 6 | **Winery card images are empty/grey placeholders**: On the `/wineries` page, all three visible winery cards show grey gradient placeholders instead of actual images. This creates a poor first impression and suggests either missing image data in the database seed or a broken image loading pipeline. | 🟠 High | Visual Design | `/wineries` page |
| 7 | **Hardcoded color values bypass design token system**: Multiple components use raw hex colors instead of CSS variables/Tailwind tokens — e.g., `bg-[#201216]` in CTA section, `bg-[#1a1215]` in footer, `bg-[#2a1a1f]` in dark mode card variants. These should reference the `--surface-dark` CSS variable or the `burgundy` palette from `tailwind.config.ts`. | 🟡 Medium | Consistency | `src/app/[locale]/page.tsx:121`, `src/components/layout/Footer.tsx:13`, `src/components/features/home/PopularExperiences.tsx:65` |
| 8 | **Hardcoded `hover:bg-[hsl(var(--primary-hover))]` pattern repeated in many places**: The primary hover color is used as an inline arbitrary value in buttons and the CTA section. This should be a Tailwind utility (e.g., `hover:bg-primary-hover`) by extending the Tailwind config with a `primary-hover` color entry. | 🟡 Medium | Consistency | `src/components/ui/button.tsx:14`, `src/components/features/home/HeroSearchBar.tsx:49`, `src/app/[locale]/page.tsx:138` |
| 9 | **No loading/skeleton state for experience cards on home page**: `PopularExperiences` is a server component that fetches data inline. If the database query is slow, the entire page render is blocked with no skeleton UI. The `FadeIn` wrapper only animates reveal on scroll — it doesn't handle loading states. Consider a Suspense boundary with a card skeleton fallback. | 🟡 Medium | UX/Usability | `src/app/[locale]/page.tsx:109-111` |
| 10 | **Mobile search bar location input has complex selector overrides**: `HeroSearchBar` applies deep nested class overrides via `[&_input]:h-14 [&_input]:border-0 [&_input]:bg-transparent...` to style the `LocationAutocomplete` input. This pattern is fragile and hard to maintain. Consider accepting a `variant` prop or `inputClassName` on `LocationAutocomplete` instead. | 🟡 Medium | Consistency | `src/components/features/home/HeroSearchBar.tsx:41` |
| 11 | **Footer uses `useTranslations` (client hook) in a component that could be a server component**: The `Footer` uses `useTranslations` which forces it to be a client component. Since the footer has no interactive elements, using `getTranslations` (server) would reduce the client bundle and improve performance. | 🟡 Medium | UX/Usability | `src/components/layout/Footer.tsx:7-10` |
| 12 | **Mixed border color tokens**: Cards on the home page use `border-gray-100 dark:border-gray-800` while the design token system defines `--border` (which maps to a warm burgundy-tinted border `hsl(345 27% 86%)`). The grey borders clash with the warm color palette. | 🟡 Medium | Consistency | `src/components/features/home/PopularExperiences.tsx:65`, `:104` |
| 13 | **Registration page left panel appears empty on desktop**: The registration page has a dark left panel with text at the bottom ("Chaque grand vin commence par la passion") but the top ~60% of the panel is empty dark space. Consider adding a background image (like the login page) or a decorative illustration. | 🟡 Medium | Visual Design | `/register` page |
| 14 | **No visible hover state feedback on experience cards (experiences listing page)**: The experience cards on `/experiences` don't show any visible hover interaction (shadow lift, image zoom, or color change). This contrasts with the home page cards that have `hover:shadow-xl` and image scale transitions. | 🟡 Medium | Micro-interactions | `/experiences` listing page |
| 15 | **"Réserver" link in experience cards is styled as text, not a button**: On the home page cards, the "Réserver" action looks like plain text (not a button variant). It has a hover background but no visual affordance indicating it's clickable. Consider using a `Button` component with `variant="ghost"` or adding an arrow icon. | 🟡 Medium | UX/Usability | `src/components/features/home/PopularExperiences.tsx:111-113` |
| 16 | **About page hero section has no background image**: The about page `/about` hero uses a solid burgundy background while the home page and wineries page use background images. This creates a visually flatter appearance and breaks the pattern. | ⚪ Low | Consistency | `/about` page |
| 17 | **FadeIn animation applies to CTA section which may cause CLS**: The CTA banner is wrapped in `<FadeIn>` which starts at `opacity-0 translate-y-6`. When the user scrolls into view, the element shifts position. While `CLS` is currently reported as 0.001, this pattern can cause layout shifts on slower devices. | ⚪ Low | Micro-interactions | `src/app/[locale]/page.tsx:119` |
| 18 | **Missing `prefers-reduced-motion` for CSS-based animations**: While the `FadeIn` component checks `prefers-reduced-motion`, CSS-level transitions in button variants (`hover:-translate-y-0.5`, `hover:scale`) and the `shimmer-gold` keyframe don't respect it. The `globals.css` reduced-motion media query catches `animation-*` but not `transition-*`. | ⚪ Low | Micro-interactions | `src/components/ui/button.tsx:14`, `src/app/globals.css:248-256` |
| 19 | **Experiences page header has faded burgundy gradient but no image**: The `/experiences` page header uses a CSS gradient (burgundy-to-transparent) without a background photo, while `/wineries` uses a beautiful wine glass image. The experiences page could benefit from a similar hero treatment. | ⚪ Low | Visual Design | `/experiences` page header |
| 20 | **Navigation doesn't highlight current page on mobile**: While the mobile `Sheet` nav uses `pathname` comparison for active state highlighting (left border + primary color), the border styling `border-l-2 border-primary` combined with `rounded-lg` creates a visual conflict — the left border is cut by the border-radius on the left corners. | ⚪ Low | Visual Design | `src/components/layout/MobileNav.tsx:112-116` |
| 21 | **HealthStatus component visible in production CTA section**: The `<HealthStatus />` development utility is rendered in the home page between the CTA section and footer. While it may be hidden or conditionally rendered, it adds unnecessary DOM nodes and vertical spacing in production. | ⚪ Low | UX/Usability | `src/app/[locale]/page.tsx:158-161` |
| 22 | **Button micro-interaction `hover:-translate-y-0.5` may feel jarring on rapid hover**: The default button variant lifts on hover, which is a nice premium touch. However, combined with `shadow-xl` and `scale-[0.98]` on active, the three simultaneous transform changes may feel over-animated on quick mouse movements across button groups. Consider reducing to just shadow change. | ⚪ Low | Micro-interactions | `src/components/ui/button.tsx:14` |
| 23 | **Duplicate `@layer base` blocks in globals.css**: Two separate `@layer base { }` blocks exist in `globals.css` (lines 90-102 and 104-112). While functionally valid, this should be consolidated into a single block for maintainability. | ⚪ Low | Consistency | `src/app/globals.css:90-112` |
| 24 | **Large page size (~5.8MB) on home page**: The home page loads ~5.8MB of total resources. The hero banner image, experience card images, and the CTA background (Unsplash URL) contribute significantly. Consider lazy-loading the CTA image, using `sizes` more aggressively, and ensuring all images use next/image `quality` optimization. | ⚪ Low | UX/Usability | `src/app/[locale]/page.tsx` |

## Criticality Legend
- 🔴 **Critical** (3 issues): Breaks functionality, causes errors, or violates core UX standards
- 🟠 **High** (3 issues): Significantly impacts user experience or design quality
- 🟡 **Medium** (9 issues): Noticeable issues that should be addressed for polish
- ⚪ **Low** (9 issues): Nice-to-have improvements for production readiness

## Strengths

| Aspect | Details |
|--------|---------|
| **Brand Identity** | Excellent warm burgundy/gold palette with Fraunces serif + Manrope sans pairing. The `premium` easing curves and warm shadows create a luxury feel appropriate for wine experiences. |
| **Design Token System** | Well-structured CSS variable system in `globals.css` with semantic naming. The Tailwind config extends these tokens with custom `burgundy`, `gold`, `cream` palettes. |
| **Accessibility Foundations** | Skip link present, proper `aria-label` on navigation, focus-visible ring styles, `prefers-reduced-motion` support in animations, proper lang attribute. |
| **SEO** | Comprehensive metadata in root layout, JSON-LD structured data, proper OpenGraph/Twitter cards, sitemap and robots.txt. |
| **i18n Architecture** | Clean next-intl setup with FR/DE/EN support, locale-prefixed routes, server-side translations where possible. |
| **Component Architecture** | Good separation between layout, features, shared, and UI components. Server components used appropriately for data fetching. |

## Next Steps

### Priority 1 — Critical Fixes
1. Fix the `JsonLd` hydration mismatch (likely needs `suppressHydrationWarning` or correct `type` attribute)
2. Ensure the hero banner image file exists at `public/images/herobanner-image.jpg`
3. Adjust the CSP `connect-src` for local development (or configure `better-auth` client base URL)

### Priority 2 — High Impact
4. Wrap the hero section inside the `<main>` landmark or add appropriate ARIA roles
5. Create a single shared `ExperienceCard` component used on both home and listing pages
6. Ensure winery images are populated in the database seed data

### Priority 3 — Design Polish
7. Replace all hardcoded hex colors with Tailwind theme tokens
8. Add a `primary-hover` color to the Tailwind config to replace `hover:bg-[hsl(var(--primary-hover))]`
9. Add Suspense boundaries with skeleton UI for async data sections
10. Audit and unify border colors across all card components to use `border-border`
