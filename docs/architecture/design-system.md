# EnCave Design System Guidelines

> **Status:** APPROVED (2026-01-09)
> **Source:** `docs/epic-1-premium-redesign-spec.md`
> **Last Updated:** 2026-01-09

This document serves as the **official design reference** for all EnCave development. All new features, components, and screens MUST adhere to these guidelines.

---

## Quick Reference

### Design Vision: "Refined Terroir"

| Principle | Description |
|-----------|-------------|
| Warm Sophistication | Warm, earthy tones inspired by wine cellars |
| Typographic Elegance | Serif display fonts for tradition, sans-serif for readability |
| Gold as Signature | Gold palette for premium accents |
| Atmospheric Depth | Subtle textures, gradients, and shadows |
| Purposeful Motion | Smooth animations that reward engagement |
| Photography-Led | Wine, vineyards, and cellars take visual prominence |

---

## Typography

### Font Families

```tsx
// Tailwind classes
font-display  // Playfair Display - Headlines, titles
font-sans     // DM Sans - Body text, UI
font-mono     // JetBrains Mono - Code, data
```

### Type Scale

| Class | Size | Usage |
|-------|------|-------|
| `text-display-xl` | 3.5rem | Hero headlines |
| `text-display-lg` | 2.75rem | Page titles |
| `text-display-md` | 2.25rem | Section headers |

### Usage Example

```tsx
// Page title
<h1 className="font-display text-display-lg text-slate-900">
  Welcome to EnCave
</h1>

// Body text
<p className="font-sans text-slate-700">
  Discover Valais wines...
</p>
```

---

## Color Palette

### Primary: Burgundy (Wine)

| Token | Hex | Usage |
|-------|-----|-------|
| `burgundy-50` | #fdf2f4 | Subtle backgrounds, hover |
| `burgundy-100` | #fce7ea | Selected states |
| `burgundy-600` | #cc2d55 | Primary buttons, focus |
| `burgundy-700` | #ab2046 | Logo, headlines |

### Accent: Gold (Luxury)

| Token | Hex | Usage |
|-------|-----|-------|
| `gold-400` | #f1c91d | Primary accent, verified badges |
| `gold-500` | #e1af10 | Hover states |
| `gold-900` | #6d4015 | Text on gold backgrounds |

### Warm Neutrals

| Token | Hex | Usage |
|-------|-----|-------|
| `cream-50` | #fdfcfa | Page backgrounds |
| `cream-100` | #faf8f5 | Card backgrounds |
| `stone-200` | #e7e5e4 | Borders, dividers |

### Usage Example

```tsx
// Page background
<main className="bg-cream-50">

// Primary button
<Button className="bg-burgundy-600 hover:bg-burgundy-500">

// Verified badge
<span className="bg-gold-400 text-gold-900">Verified</span>
```

---

## Spacing & Layout

### Key Principles

- **Generous Breath**: Let elements breathe with ample whitespace
- **Max Width**: `max-w-6xl` for content containers
- **Card Padding**: `p-6 sm:p-8` minimum
- **Section Spacing**: `py-16 lg:py-20`

### Component Sizing

| Component | Standard |
|-----------|----------|
| Card padding | `p-6 sm:p-8` |
| Card radius | `rounded-xl` (12px) |
| Button height | `h-11` (44px) default |
| Input height | `h-11` (44px) |
| Header height | `h-20` (80px) |

---

## Shadows

Use warm, burgundy-tinted shadows:

```tsx
shadow-warm-sm  // Subtle
shadow-warm     // Default
shadow-warm-md  // Medium
shadow-warm-lg  // Large
shadow-gold     // Gold glow for premium elements
```

---

## Components

### Buttons

```tsx
// Primary (default)
<Button>Book Now</Button>

// Secondary
<Button variant="secondary">Learn More</Button>

// Outline
<Button variant="outline">Cancel</Button>
```

**Primary Button Features:**
- Gradient background (`from-burgundy-600 to-burgundy-700`)
- Hover lift (`hover:-translate-y-0.5`)
- Shadow enhancement on hover

### Cards

```tsx
<Card className="rounded-xl shadow-warm hover:-translate-y-1 hover:shadow-warm-lg transition-all">
  <CardContent className="p-6 sm:p-8">
    {/* Content */}
  </CardContent>
</Card>
```

### Inputs

```tsx
<Input
  className="h-11 rounded-lg border-stone-300 focus:border-burgundy-400 focus:ring-burgundy-500/20"
/>
```

### Verified Badge

```tsx
<span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 text-gold-950 font-medium px-2 py-1">
  <CheckIcon className="h-3.5 w-3.5" />
  Verified
</span>
```

---

## Animation Guidelines

### CSS Variables

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Duration Budget

| Type | Duration |
|------|----------|
| Micro-interactions | 150-250ms |
| Component transitions | 200-350ms |
| Page transitions | 300-500ms |

### Accessibility

```css
@media (prefers-reduced-motion: reduce) {
  /* Animations disabled automatically */
}
```

---

## Accessibility Requirements

### Compliance: WCAG 2.1 Level AA

| Requirement | Standard |
|-------------|----------|
| Color contrast | 4.5:1 minimum for text |
| Touch targets | 44x44px minimum |
| Focus indicators | Burgundy ring with offset |
| Screen readers | Semantic HTML, ARIA labels |

### Focus Ring

```tsx
focus:ring-2 focus:ring-burgundy-500 focus:ring-offset-2
```

---

## File References

| Reference | Location |
|-----------|----------|
| Full Specification | `docs/epic-1-premium-redesign-spec.md` |
| Tailwind Config | `tailwind.config.ts` |
| Global CSS | `src/app/globals.css` |
| UI Components | `src/components/ui/` |

---

## Checklist for New Features

Before implementing any new UI:

- [ ] Using `font-display` for headlines?
- [ ] Using warm color palette (burgundy, gold, cream)?
- [ ] Card padding is `p-6 sm:p-8` minimum?
- [ ] Buttons are `h-11` (44px) for touch targets?
- [ ] Shadows use `shadow-warm-*` variants?
- [ ] Focus rings are burgundy?
- [ ] Respects `prefers-reduced-motion`?
- [ ] Color contrast meets 4.5:1?

---

_This document is the official design standard. For detailed specifications, refer to `docs/epic-1-premium-redesign-spec.md`._
