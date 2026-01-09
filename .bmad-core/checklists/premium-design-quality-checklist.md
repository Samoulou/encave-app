# Premium Design Quality Checklist

## Purpose

This checklist ensures all future development maintains the premium "Refined Terroir" design language established during the Design Sprint (DS-1 through DS-7). Use this checklist during development and code review to guarantee visual consistency and UX quality.

[[LLM: INITIALIZATION INSTRUCTIONS - PREMIUM DESIGN VALIDATION

This checklist is for DEVELOPER AGENTS and CODE REVIEWERS to validate that new or modified UI follows the established design system.

CRITICAL: This is not just a style guide - these are mandatory standards. Non-compliance should block PR approval.

EXECUTION APPROACH:

1. Go through each section relevant to your changes
2. Mark items as [x] Done, [ ] Not Done, or [N/A] Not Applicable
3. Add comments explaining any [ ] or [N/A] items
4. Reference specific files/components in your responses
5. If uncertain, check existing implementation in similar components

REFERENCE DOCUMENTS:
- UX Spec: `docs/epic-1-premium-redesign-spec.md`
- Design Sprint Stories: `docs/stories/design-sprint/DS-*.md`
- Tailwind Config: `tailwind.config.ts`
- Global CSS: `src/app/globals.css`
]]

---

## 1. Typography Standards

[[LLM: Typography creates the premium feel. Wrong fonts instantly break the brand.]]

### 1.1 Font Family Usage

- [ ] **Display text** (headlines, page titles, card titles) uses `font-display` (Playfair Display)
- [ ] **Body text** (paragraphs, labels, UI text) uses `font-sans` (DM Sans)
- [ ] **Monospace** (code, technical data, tables) uses `font-mono` (JetBrains Mono)
- [ ] No raw `font-serif`, `font-sans-serif`, or system font fallbacks used directly

### 1.2 Type Scale Usage

| Element | Required Class | Check |
|---------|---------------|-------|
| Hero headlines | `text-display-xl` or `text-display-lg` | [ ] |
| Page titles | `text-display-lg` or `text-display-md` | [ ] |
| Section headers | `text-display-md` or `font-display text-xl` | [ ] |
| Card titles | `font-display text-lg font-semibold` | [ ] |
| Body text | Default or `text-slate-700` | [ ] |
| Small/caption text | `text-sm text-slate-500` or `text-xs` | [ ] |

### 1.3 Typography Anti-Patterns (AVOID)

- [ ] NOT using generic `text-3xl font-bold` without `font-display`
- [ ] NOT using `text-gray-*` colors (use `text-slate-*` instead)
- [ ] NOT using `text-black` directly (use `text-slate-900`)
- [ ] NOT mixing headline styles inconsistently within a page

---

## 2. Color Palette Compliance

[[LLM: The warm color palette is central to premium feel. Cold grays destroy it.]]

### 2.1 Background Colors

- [ ] **Page backgrounds** use `bg-cream-50` (NOT `bg-white`, `bg-slate-50`, or `bg-gray-*`)
- [ ] **Card backgrounds** use `bg-white` with appropriate warm shadow
- [ ] **Section backgrounds** use `bg-cream-100` or `bg-cream-200` for alternating sections
- [ ] **Hero overlays** use `gradient-hero` or burgundy gradient (NOT plain black overlay)

### 2.2 Primary Colors (Burgundy)

| Usage | Required Pattern | Check |
|-------|-----------------|-------|
| Primary buttons | `bg-burgundy-600` to `bg-burgundy-700` gradient | [ ] |
| Links | `text-burgundy-600 hover:text-burgundy-800` | [ ] |
| Focus rings | `ring-burgundy-500 ring-offset-2` | [ ] |
| Accents | `text-burgundy-700` or `border-burgundy-*` | [ ] |

### 2.3 Accent Colors (Gold)

- [ ] **Verified badges** use gold gradient (`from-gold-400 to-gold-500`)
- [ ] **Premium highlights** use `gold-400` as accent
- [ ] **Link underlines** use gold gradient on hover
- [ ] Gold is used SPARINGLY (max 1-2 elements per view)

### 2.4 Neutral Colors

| Element | Correct | Incorrect (AVOID) |
|---------|---------|-------------------|
| Body text | `text-slate-700` | `text-gray-600` |
| Secondary text | `text-slate-500/600` | `text-gray-400/500` |
| Borders | `border-stone-200` | `border-gray-200` |
| Disabled | `opacity-50` | `text-gray-300` |

### 2.5 Color Anti-Patterns (AVOID)

- [ ] NOT using any `gray-*` colors (use `slate-*` or `stone-*`)
- [ ] NOT using `bg-white` for page backgrounds
- [ ] NOT using pure black overlays (use burgundy gradients)
- [ ] NOT using blue/indigo for interactive elements

---

## 3. Shadow System

[[LLM: Warm shadows create depth. Default Tailwind shadows feel cold.]]

### 3.1 Shadow Usage

- [ ] **Cards** use warm shadows: `shadow-[0_1px_3px_rgba(122,27,59,0.04),0_4px_12px_rgba(122,27,59,0.03)]`
- [ ] **Elevated cards on hover** use: `shadow-[0_12px_40px_rgba(122,27,59,0.12)]`
- [ ] **Buttons** use: `shadow-md shadow-burgundy-900/10`
- [ ] NOT using default Tailwind `shadow-sm`, `shadow`, `shadow-lg` without warm tint

### 3.2 Shadow Class Reference

| Component | Default Shadow | Hover Shadow |
|-----------|---------------|--------------|
| Card | `shadow-warm` or inline rgba | `shadow-[0_12px_40px_rgba(122,27,59,0.12)]` |
| Button | `shadow-md shadow-burgundy-900/10` | `shadow-lg shadow-burgundy-900/15` |
| Header | None (uses backdrop-blur) | N/A |
| Dropdown | `shadow-lg` with warm tint | N/A |

---

## 4. Spacing & Layout

[[LLM: Luxury = generous whitespace. Cramped = cheap.]]

### 4.1 Page Layout

- [ ] **Max content width** is `max-w-6xl` (1152px) for main content
- [ ] **Page horizontal padding** is `px-6 lg:px-8` minimum (NOT `px-4`)
- [ ] **Page vertical padding** is `py-10 lg:py-12` minimum
- [ ] **Section spacing** is `py-16 lg:py-20` between major sections

### 4.2 Card Spacing

- [ ] **Card padding** is `p-5 sm:p-6` minimum (NOT `p-4`)
- [ ] **Card border radius** is `rounded-xl` (12px) (NOT `rounded-lg`)
- [ ] **Card grid gaps** are `gap-8` (NOT `gap-4` or `gap-6`)
- [ ] **Card grid columns** follow: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

### 4.3 Form Spacing

- [ ] **Field spacing** is `space-y-6` (NOT `space-y-4`)
- [ ] **Section spacing** is `space-y-8` or `space-y-10`
- [ ] **Input height** is `h-11` (44px) for touch targets
- [ ] **Form max width** is `max-w-md` or `max-w-lg`

### 4.4 Button Spacing

| Size | Height | Padding |
|------|--------|---------|
| Default | `h-11` (44px) | `px-6 py-2.5` |
| Small | `h-9` (36px) | `px-4` |
| Large | `h-12` (48px) | `px-8` |
| Icon | `h-11 w-11` | N/A |

### 4.5 Spacing Anti-Patterns (AVOID)

- [ ] NOT using `p-4` on cards (too cramped)
- [ ] NOT using `gap-4` on card grids
- [ ] NOT using `max-w-7xl` for content (too wide)
- [ ] NOT using `rounded-lg` on cards (use `rounded-xl`)

---

## 5. Component Standards

[[LLM: Components must follow established patterns exactly.]]

### 5.1 Button Component

- [ ] Uses `buttonVariants` from `@/components/ui/button`
- [ ] Primary buttons have gradient: `from-burgundy-600 to-burgundy-700`
- [ ] Hover includes lift effect: `hover:-translate-y-0.5`
- [ ] Active returns to base: `active:translate-y-0`
- [ ] Uses `MotionButton` for spring animations when appropriate

### 5.2 Card Component

- [ ] Uses Card component from `@/components/ui/card`
- [ ] Has warm shadow (burgundy-tinted)
- [ ] Has `rounded-xl` border radius
- [ ] Hover state includes lift: `hover:-translate-y-1`
- [ ] Border uses `border-stone-200/60`

### 5.3 Input Component

- [ ] Uses Input from `@/components/ui/input`
- [ ] Focus ring is burgundy: `focus:ring-burgundy-500/20`
- [ ] Border transitions: `transition-all duration-200`
- [ ] Height is `h-11` (44px)
- [ ] Placeholder is italic: `placeholder:italic`

### 5.4 WineryCard Component

- [ ] Image has zoom on hover: `group-hover:scale-105`
- [ ] Card has lift on hover: `hover:-translate-y-1`
- [ ] Title changes color on hover: `group-hover:text-burgundy-700`
- [ ] Arrow slides on hover: `group-hover:translate-x-1`
- [ ] VerifiedBadge positioned top-right of image
- [ ] Gradient overlay on image: `from-black/40 via-transparent to-transparent`

### 5.5 Header Component

- [ ] Uses backdrop blur: `bg-white/95 backdrop-blur-md`
- [ ] Height is `h-20` (80px)
- [ ] Logo includes icon mark (wine icon in colored square)
- [ ] Uses `font-display` for logo text
- [ ] Border uses `border-stone-200/60`

### 5.6 EmptyState Component

- [ ] Has gradient background
- [ ] Uses wine-related icon (Wine glass)
- [ ] Typography follows premium standards

---

## 6. Animation & Micro-interactions

[[LLM: Animations must be subtle, purposeful, and performant.]]

### 6.1 Animation Requirements

- [ ] All animations use `transform` and `opacity` only (GPU-accelerated)
- [ ] Transition duration is 200-300ms for micro-interactions
- [ ] Uses custom easing: `var(--ease-out)` or `var(--ease-spring)`
- [ ] Spring physics via Framer Motion where applicable

### 6.2 Required Interactions

| Element | Interaction | Check |
|---------|------------|-------|
| Buttons | Scale 1.02 hover, 0.98 tap | [ ] |
| Cards | Lift -4px + shadow enhancement | [ ] |
| Links | Gold underline grows from left | [ ] |
| Images in cards | Scale 1.05 on parent hover | [ ] |
| Arrows/CTAs | Translate-x on hover | [ ] |

### 6.3 Page Transitions

- [ ] Uses `template.tsx` wrapper for page transitions
- [ ] Fade + y-axis movement (300ms)
- [ ] Uses `var(--ease-out)` easing

### 6.4 Staggered Animations

- [ ] Card grids use staggered reveal: `staggerChildren: 0.08`
- [ ] Initial delay: `delayChildren: 0.1`
- [ ] Uses `AnimatedGrid` component when appropriate

### 6.5 Reduced Motion Support

- [ ] Respects `prefers-reduced-motion: reduce`
- [ ] CSS includes: `@media (prefers-reduced-motion: reduce)`
- [ ] Framer Motion animations honor system setting

### 6.6 Animation Anti-Patterns (AVOID)

- [ ] NOT using animations longer than 500ms (except loading states)
- [ ] NOT animating `width`, `height`, `top`, `left` (use transform)
- [ ] NOT using jarring or bouncy animations
- [ ] NOT auto-playing animations without user control

---

## 7. Image Standards

[[LLM: Images are not placeholders - they set the emotional tone.]]

### 7.1 Image Implementation

- [ ] Uses Next.js `<Image>` component (NOT `<img>`)
- [ ] Has proper `sizes` attribute for responsive loading
- [ ] Has meaningful `alt` text (NOT empty unless decorative)
- [ ] Uses `priority` for above-the-fold images
- [ ] Uses `fill` with `object-cover` for background images

### 7.2 Image Fallbacks

- [ ] Cards without images show wine-themed gradient placeholder
- [ ] Placeholder includes wine icon (Wine glass)
- [ ] Gradient uses: `from-burgundy-100 to-burgundy-200`

### 7.3 Image Overlays

- [ ] Hero images use burgundy gradient overlay (NOT plain black)
- [ ] Overlay gradient: `from-burgundy-950/70 to-burgundy-900/40`
- [ ] Card image overlays: `from-black/40 via-transparent to-transparent`

### 7.4 Image Aspect Ratios

| Context | Aspect Ratio | Class |
|---------|-------------|-------|
| Winery card | 4:3 | `aspect-[4/3]` |
| Hero banner | ~3:1 | `h-[40vh]` or similar |
| Cover photos | 16:9 | `aspect-video` |

---

## 8. Accessibility Standards

[[LLM: Accessibility is non-negotiable. Premium means accessible to all.]]

### 8.1 Color Contrast

- [ ] Body text (`slate-700` on `cream-50`) passes AA: 10.5:1 ratio
- [ ] Link text (`burgundy-600`) passes AA: 5.2:1 ratio
- [ ] Button text (white on `burgundy-600`) passes AA: 4.8:1 ratio
- [ ] Essential placeholder text uses `slate-500` (NOT `slate-400`)

### 8.2 Focus States

- [ ] All interactive elements have visible focus ring
- [ ] Focus ring is burgundy: `ring-burgundy-500 ring-offset-2`
- [ ] Focus is visible in both light and dark contexts
- [ ] No `outline: none` without alternative focus indicator

### 8.3 Keyboard Navigation

- [ ] All interactive elements reachable via Tab
- [ ] Tab order is logical (follows visual order)
- [ ] Enter/Space activates buttons
- [ ] Escape closes modals/dropdowns
- [ ] No keyboard traps

### 8.4 Touch Targets

- [ ] Minimum touch target is 44x44px
- [ ] Buttons use `h-11` (44px) minimum
- [ ] Icon buttons include padding for 44px area
- [ ] Links have sufficient padding/margin

### 8.5 Screen Reader Support

- [ ] Semantic HTML: `<header>`, `<nav>`, `<main>`, `<footer>`, `<article>`
- [ ] Heading hierarchy: h1 -> h2 -> h3 (no skipping)
- [ ] Icon buttons have `aria-label`
- [ ] Form inputs have associated `<label>`
- [ ] Error messages linked via `aria-describedby`
- [ ] Live regions (`aria-live`) for dynamic content

### 8.6 Form Accessibility

- [ ] All inputs have visible labels (NOT placeholder-only)
- [ ] Required fields marked with `aria-required="true"`
- [ ] Invalid fields marked with `aria-invalid="true"`
- [ ] Character counters use `aria-live="polite"`
- [ ] Error messages are descriptive and actionable

---

## 9. Code Quality Standards

[[LLM: Clean code = maintainable design system.]]

### 9.1 Component Structure

- [ ] Uses existing shared components (don't recreate)
- [ ] Extends components via `className` prop (don't duplicate)
- [ ] Uses `cn()` utility for conditional classes
- [ ] Follows file naming: `PascalCase.tsx` for components

### 9.2 Tailwind Best Practices

- [ ] Uses design tokens (NOT arbitrary values like `text-[#abc123]`)
- [ ] Groups related utilities logically
- [ ] Uses responsive prefixes consistently: `sm:`, `md:`, `lg:`
- [ ] Avoids `!important` and arbitrary overrides

### 9.3 Import Standards

```tsx
// Correct import order
import { motion } from 'framer-motion';           // External
import { cn } from '@/lib/utils';                  // Internal utilities
import { Button } from '@/components/ui/button';   // UI components
import { WineryCard } from '@/components/features/winery/WineryCard'; // Feature components
```

### 9.4 Component Props

- [ ] Props interface is explicitly typed
- [ ] Optional props have sensible defaults
- [ ] Destructures `className` for composition
- [ ] Forwards `ref` when needed

---

## 10. Pre-Commit Checklist

[[LLM: Run through this quick checklist before every commit.]]

### Quick Visual Check

- [ ] Page backgrounds are cream/warm (not white/gray)
- [ ] Headlines use serif font (Playfair Display)
- [ ] Cards have rounded corners and warm shadows
- [ ] Buttons have gradient and lift effect
- [ ] Interactive elements have hover states
- [ ] Focus rings are visible and burgundy

### Quick Code Check

- [ ] No `gray-*` color classes
- [ ] No default Tailwind shadows (must be warm-tinted)
- [ ] No `rounded-lg` on cards (use `rounded-xl`)
- [ ] No `p-4` on cards (use `p-5` or `p-6`)
- [ ] All images use Next.js `<Image>`
- [ ] All animations respect reduced motion

---

## Reference Quick Cards

### Color Quick Reference

| Use Case | Class |
|----------|-------|
| Page background | `bg-cream-50` |
| Card background | `bg-white` + warm shadow |
| Primary button | `bg-burgundy-600` |
| Link text | `text-burgundy-600` |
| Body text | `text-slate-700` |
| Secondary text | `text-slate-500` |
| Border | `border-stone-200` |
| Focus ring | `ring-burgundy-500` |
| Verified badge | `bg-gold-400` |

### Spacing Quick Reference

| Element | Padding/Gap |
|---------|------------|
| Page | `px-6 lg:px-8` |
| Card | `p-5 sm:p-6` |
| Card grid | `gap-8` |
| Form fields | `space-y-6` |
| Sections | `py-10 lg:py-12` |

### Component Import Reference

```tsx
// UI Components
import { Button, MotionButton } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// Shared Components
import { VerifiedBadge } from '@/components/shared/VerifiedBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { AnimatedGrid, AnimatedGridItem } from '@/components/shared/AnimatedGrid';
import { SuccessCheckmark } from '@/components/shared/SuccessCheckmark';
import { AnimatedProgressBar } from '@/components/shared/AnimatedProgressBar';
```

---

## Final Confirmation

- [ ] I confirm all relevant sections of this checklist have been reviewed
- [ ] Any deviations from standards are documented with justification
- [ ] The implementation maintains the premium "Refined Terroir" aesthetic
- [ ] Accessibility requirements have been verified

---

*Checklist created by Sally (UX Expert) on 2026-01-09*
*Based on Design Sprint DS-1 through DS-7*
