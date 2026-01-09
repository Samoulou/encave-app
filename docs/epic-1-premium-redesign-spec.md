# EnCave EPIC 1 Premium Redesign Specification

## Document Info

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| **Project**  | EnCave - Wine Experience Booking Platform |
| **Version**  | 1.0                                       |
| **Date**     | 2026-01-09                                |
| **Author**   | Sally (UX Expert)                         |
| **Status**   | Ready for Implementation                  |
| **Scope**    | EPIC 1: Foundation & Identity (9 screens) |

---

## Table of Contents

1. [Design Vision](#1-design-vision)
2. [Typography & Type Scale](#2-typography--type-scale)
3. [Color Palette & Application](#3-color-palette--application)
4. [Spacing & Layout System](#4-spacing--layout-system)
5. [Component Specifications](#5-component-specifications)
6. [EPIC 1 Screen Redesigns](#6-epic-1-screen-redesigns)
7. [Animation & Micro-interactions](#7-animation--micro-interactions)
8. [Accessibility Requirements](#8-accessibility-requirements)
9. [Implementation Checklist](#9-implementation-checklist)

---

## 1. Design Vision

### Purpose

This specification defines the visual and experiential upgrades required to transform EnCave's EPIC 1 screens (Foundation & Identity) from a generic SaaS aesthetic to a premium wine discovery platform worthy of Valais's world-class wines.

### Scope

**9 screens across EPIC 1:**
- Login, Register
- Winery Onboarding (2 screens)
- Winery Profile Edit
- Winery Directory, Winery Detail
- Admin Dashboard, Admin Verification Queue, Admin Winery Review

### Design Vision: "Refined Terroir"

| Principle | Description |
|-----------|-------------|
| **Warm Sophistication** | Replace cold tech grays with warm, earthy tones inspired by wine cellars and Valais stone |
| **Typographic Elegance** | Serif display fonts for headlines evoke tradition; refined sans-serif for body maintains readability |
| **Gold as Signature** | The gold palette becomes a premium accent - borders, hovers, and highlights |
| **Atmospheric Depth** | Subtle textures, gradients, and shadows create visual depth and warmth |
| **Purposeful Motion** | Smooth entrance animations and micro-interactions reward engagement |
| **Photography-Led** | Wine, vineyards, and cellars take visual prominence - imagery isn't placeholder |

---

## 2. Typography & Type Scale

### Typography Strategy: Dual-Font Hierarchy

| Role | Font | Rationale |
|------|------|-----------|
| **Display (Headlines)** | **Playfair Display** | Elegant serif with high contrast strokes, widely used in wine/luxury brands. Free via Google Fonts. |
| **Body (UI Text)** | **DM Sans** | Modern geometric sans-serif with warmth. More refined than Inter, excellent readability. Free via Google Fonts. |
| **Monospace (Code/Data)** | **JetBrains Mono** | For admin tables, technical data. |

### Type Scale (Desktop)

| Element | Font | Size | Weight | Line Height | Letter Spacing | Usage |
|---------|------|------|--------|-------------|----------------|-------|
| **Display XL** | Playfair Display | 56px (3.5rem) | 700 | 1.1 | -0.02em | Hero headlines, landing page |
| **Display L** | Playfair Display | 44px (2.75rem) | 700 | 1.15 | -0.02em | Page titles |
| **Display M** | Playfair Display | 36px (2.25rem) | 600 | 1.2 | -0.01em | Section headers |
| **H1** | Playfair Display | 30px (1.875rem) | 600 | 1.25 | 0 | Card titles, form headers |
| **H2** | DM Sans | 24px (1.5rem) | 600 | 1.3 | 0 | Subsection headers |
| **H3** | DM Sans | 20px (1.25rem) | 600 | 1.4 | 0 | Component headers |
| **Body L** | DM Sans | 18px (1.125rem) | 400 | 1.6 | 0 | Lead paragraphs, important text |
| **Body** | DM Sans | 16px (1rem) | 400 | 1.6 | 0 | Default body text |
| **Body S** | DM Sans | 14px (0.875rem) | 400 | 1.5 | 0 | Secondary text, captions |
| **Label** | DM Sans | 14px (0.875rem) | 500 | 1.4 | 0.01em | Form labels, buttons |
| **Caption** | DM Sans | 12px (0.75rem) | 400 | 1.4 | 0.02em | Helper text, timestamps |

### Mobile Scaling

| Element | Desktop | Mobile (< 768px) |
|---------|---------|------------------|
| Display XL | 56px | 36px |
| Display L | 44px | 30px |
| Display M | 36px | 26px |
| H1 | 30px | 24px |
| Body | 16px | 16px (unchanged) |

### Tailwind Configuration

```typescript
// tailwind.config.ts additions
fontFamily: {
  display: ['Playfair Display', 'Georgia', 'serif'],
  sans: ['DM Sans', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],
},
fontSize: {
  'display-xl': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
  'display-lg': ['2.75rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
  'display-md': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
}
```

### Before/After Examples

| Element | Current | Premium Redesign |
|---------|---------|------------------|
| Logo "EnCave" | `text-xl font-bold text-burgundy-700` (Inter) | `font-display text-display-md text-burgundy-800` (Playfair) |
| Page Title | `text-3xl font-bold text-slate-900` | `font-display text-display-lg text-slate-900` |
| Card Title | `font-semibold text-slate-900` | `font-display text-xl font-semibold text-slate-900` |
| Body Text | `text-slate-600` | `font-sans text-slate-700` (warmer gray) |

---

## 3. Color Palette & Application

### Color Philosophy

The current implementation uses burgundy for buttons and slate for everything else. The gold palette exists in config but is **never applied**. This section activates the full palette with intentional hierarchy.

### Primary Palette: Burgundy (Wine)

| Token | Hex | Current Usage | Premium Usage |
|-------|-----|---------------|---------------|
| `burgundy-50` | #fdf2f4 | Never | Subtle backgrounds, hover states |
| `burgundy-100` | #fce7ea | Never | Card backgrounds, selected states |
| `burgundy-200` | #f9d0d8 | Never | Borders, dividers |
| `burgundy-300` | #f4a9b8 | Never | Disabled states |
| `burgundy-400` | #ed7a93 | Never | Secondary accents |
| `burgundy-500` | #e14d6f | Never | Links, interactive elements |
| `burgundy-600` | #cc2d55 | Primary buttons | Primary buttons, focus rings |
| `burgundy-700` | #ab2046 | Logo text | Logo, primary headlines |
| `burgundy-800` | #8f1d3f | Never | Dark mode primary |
| `burgundy-900` | #7a1b3b | Never | Deep accents, footer |
| `burgundy-950` | #450a1c | Never | Darkest overlays |

### Accent Palette: Gold (Luxury Signature)

| Token | Hex | Current Usage | Premium Usage |
|-------|-----|---------------|---------------|
| `gold-50` | #fdfbe9 | **NEVER** | Premium card backgrounds |
| `gold-100` | #fcf7c5 | **NEVER** | Highlight backgrounds |
| `gold-200` | #faed8e | **NEVER** | Badges, tags |
| `gold-300` | #f6dc4d | **NEVER** | Stars, ratings |
| `gold-400` | #f1c91d | **NEVER** | **Primary accent**, verified badges |
| `gold-500` | #e1af10 | **NEVER** | Hover state for gold elements |
| `gold-600` | #c2880b | **NEVER** | Active state, pressed |
| `gold-700` | #9b620c | **NEVER** | Dark gold text |
| `gold-800` | #804e12 | **NEVER** | Dark mode gold |
| `gold-900` | #6d4015 | **NEVER** | Deep gold accents |

### Warm Neutrals (New)

| Token | Hex | Usage |
|-------|-----|-------|
| `cream-50` | #fdfcfa | Page backgrounds |
| `cream-100` | #faf8f5 | Card backgrounds |
| `cream-200` | #f5f2ed | Section backgrounds |
| `stone-100` | #f5f5f4 | Alternative neutral bg |
| `stone-200` | #e7e5e4 | Borders, dividers |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `success` | #059669 (emerald-600) | Verified badges, confirmations |
| `warning` | #d97706 (amber-600) | Pending states, cautions |
| `error` | #dc2626 (red-600) | Errors, destructive actions |
| `info` | #0284c7 (sky-600) | Informational messages |

### Color Application Matrix

| Element | Current | Premium Redesign |
|---------|---------|------------------|
| **Page Background** | `bg-slate-50` | `bg-cream-50` or `bg-[#fdfcfa]` |
| **Card Background** | `bg-white` | `bg-white` with `shadow-warm` |
| **Header** | `bg-white border-slate-200` | `bg-white/95 backdrop-blur border-gold-200/50` |
| **Primary Button** | `bg-burgundy-600` | `bg-burgundy-600` + gold hover glow |
| **Secondary Button** | `bg-slate-100` | `bg-cream-100 border-burgundy-200` |
| **Links** | `text-burgundy-600` | `text-burgundy-600` with gold underline on hover |
| **Verified Badge** | None exists | `bg-gold-400 text-gold-900` |
| **Body Text** | `text-slate-600` | `text-slate-700` (warmer, higher contrast) |
| **Borders** | `border-slate-200` | `border-stone-200` or `border-burgundy-100` |
| **Focus Ring** | `ring-slate-950` | `ring-burgundy-500 ring-offset-2` |

### Gradient Definitions

```css
/* Hero gradient overlay */
.gradient-hero {
  background: linear-gradient(
    to bottom,
    rgba(69, 10, 28, 0.7),  /* burgundy-950 */
    rgba(122, 27, 59, 0.4)   /* burgundy-900 */
  );
}

/* Premium card shimmer */
.gradient-gold-subtle {
  background: linear-gradient(
    135deg,
    rgba(241, 201, 29, 0.05),  /* gold-400 */
    transparent 50%,
    rgba(241, 201, 29, 0.03)
  );
}

/* Warm page background */
.gradient-warm-bg {
  background: linear-gradient(
    180deg,
    #fdfcfa 0%,
    #faf8f5 100%
  );
}
```

### Shadow System (Warmer)

| Token | Current | Premium (Warmer) |
|-------|---------|------------------|
| `shadow-sm` | Default Tailwind | `0 1px 2px rgba(122, 27, 59, 0.05)` |
| `shadow` | Default | `0 1px 3px rgba(122, 27, 59, 0.08), 0 1px 2px rgba(122, 27, 59, 0.04)` |
| `shadow-md` | Default | `0 4px 6px rgba(122, 27, 59, 0.07), 0 2px 4px rgba(122, 27, 59, 0.04)` |
| `shadow-lg` | Default | `0 10px 15px rgba(122, 27, 59, 0.08), 0 4px 6px rgba(122, 27, 59, 0.04)` |
| `shadow-gold` | None | `0 4px 14px rgba(241, 201, 29, 0.15)` |

---

## 4. Spacing & Layout System

### Spacing Philosophy: "Generous Breath"

Luxury brands use whitespace as a design element. Current implementation crams content; premium redesign lets elements breathe.

| Principle | Description |
|-----------|-------------|
| **Generous Margins** | Page-level padding increases 50-100% from current |
| **Optical Spacing** | Headings get extra top margin to create visual separation |
| **Card Breathing Room** | Internal padding increases; content doesn't touch edges |
| **Touch Target Luxury** | Buttons and interactive elements feel substantial |

### Spacing Scale

| Token | Value | Current Usage | Premium Usage |
|-------|-------|---------------|---------------|
| `space-1` | 4px | Tight gaps | Icon gaps only |
| `space-2` | 8px | Common | Inline element gaps |
| `space-3` | 12px | Common | Small component padding |
| `space-4` | 16px | Default padding | Minimum card padding |
| `space-6` | 24px | Section gaps | **Standard card padding** |
| `space-8` | 32px | Rare | Section gaps, form spacing |
| `space-10` | 40px | Never | **Page section margins** |
| `space-12` | 48px | Never | Major section breaks |
| `space-16` | 64px | Never | Hero section padding |
| `space-20` | 80px | Never | Page top/bottom margins |
| `space-24` | 96px | Never | Premium hero sections |

### Container & Page Layout

| Element | Current | Premium Redesign |
|---------|---------|------------------|
| **Max container width** | `max-w-7xl` (1280px) | `max-w-6xl` (1152px) for content, full-bleed for heroes |
| **Page horizontal padding** | `px-4` (16px) | `px-6 sm:px-8 lg:px-12` (24-48px) |
| **Page top padding** | `py-8` | `pt-12 pb-16` (asymmetric, more bottom) |
| **Section spacing** | `py-8` | `py-16 lg:py-20` |
| **Card padding** | `p-4` or `p-6` | `p-6 sm:p-8` minimum |

### Grid System

| Grid Type | Current | Premium |
|-----------|---------|---------|
| **Winery cards** | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6` | `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8` |
| **Gallery images** | `grid-cols-2 md:grid-cols-3 gap-4` | `grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6` |
| **Form layout** | Single column | Single column, max-width `max-w-md` for inputs |

### Component Spacing Standards

**Cards:**

| Property | Current | Premium |
|----------|---------|---------|
| Padding | `p-4` | `p-6 sm:p-8` |
| Border radius | `rounded-lg` (8px) | `rounded-xl` (12px) |
| Image-to-content gap | Implicit | `space-y-5` |
| Title-to-description | `mt-1` | `mt-2` |

**Forms:**

| Property | Current | Premium |
|----------|---------|---------|
| Field spacing | `space-y-4` | `space-y-6` |
| Label-to-input gap | Default | `space-y-2` |
| Section breaks | None | `space-y-10` with subtle divider |
| Input padding | `px-3 py-2` | `px-4 py-3` |
| Form max-width | None | `max-w-lg` (512px) |

**Buttons:**

| Size | Current | Premium |
|------|---------|---------|
| Default | `h-10 px-4 py-2` | `h-11 px-6 py-2.5` |
| Small | `h-9 px-3` | `h-9 px-4` |
| Large | `h-11 px-8` | `h-12 px-8` |

### Header & Navigation

| Property | Current | Premium |
|----------|---------|---------|
| Header height | `h-16` (64px) | `h-20` (80px) |
| Logo size | `text-xl` | `text-2xl` with mark |
| Nav item spacing | `gap-4` | `gap-6 lg:gap-8` |
| Header padding | `px-4` | `px-6 lg:px-8` |

### Responsive Breakpoints

| Breakpoint | Width | Layout Behavior |
|------------|-------|-----------------|
| **Mobile** | < 640px | Single column, full-bleed cards, stacked nav |
| **Tablet** | 640-1023px | 2-column grids, expanded nav |
| **Desktop** | 1024-1279px | 3-column grids, full nav |
| **Wide** | ≥ 1280px | Content max-width, generous margins |

---

## 5. Component Specifications

### 5.1 Button Component

**Premium Button Variants:**

| Variant | Specification |
|---------|---------------|
| **Default (Primary)** | Subtle gradient, shadow, gold glow on hover |
| **Secondary** | Warm cream background, burgundy border |
| **Outline** | `border-burgundy-300` with warm fill on hover |
| **Ghost** | `hover:bg-burgundy-50` |
| **Link** | Gold underline animation on hover |

**Tailwind Implementation:**

```tsx
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-gradient-to-b from-burgundy-600 to-burgundy-700 text-white shadow-md shadow-burgundy-900/10 hover:from-burgundy-500 hover:to-burgundy-600 hover:shadow-lg hover:shadow-burgundy-900/15 hover:-translate-y-0.5 active:translate-y-0',
        secondary: 'bg-cream-100 text-burgundy-800 border border-burgundy-200 hover:bg-burgundy-50 hover:border-burgundy-300',
        outline: 'border-2 border-burgundy-300 text-burgundy-700 hover:bg-burgundy-50',
        ghost: 'text-burgundy-700 hover:bg-burgundy-50',
        link: 'text-burgundy-600 underline-offset-4 hover:text-burgundy-800 decoration-gold-400 hover:underline',
      },
      size: {
        default: 'h-11 px-6 py-2.5',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-12 px-8 text-base',
        icon: 'h-11 w-11',
      },
    },
  }
);
```

### 5.2 Card Component

**Premium Card Styling:**

| Property | Current | Premium |
|----------|---------|---------|
| Background | `bg-white` | `bg-white` with subtle warm tint |
| Border | `border border-slate-200` | `border border-stone-200/60` or no border |
| Border radius | `rounded-lg` (8px) | `rounded-xl` (12px) |
| Shadow | `shadow-sm` | Warm burgundy-tinted shadow |
| Padding | `p-6` | `p-6 sm:p-8` |
| Hover | `hover:shadow-lg` | Lift + enhanced shadow + subtle border glow |

**Tailwind Implementation:**

```tsx
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-stone-200/60 bg-white shadow-[0_1px_3px_rgba(122,27,59,0.04),0_4px_12px_rgba(122,27,59,0.03)] transition-all duration-250',
        className
      )}
      {...props}
    />
  )
);
```

### 5.3 WineryCard Component

**Premium WineryCard Structure:**

```tsx
<Link href={`/wineries/${winery.slug}`}>
  <Card className="group h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(122,27,59,0.12)]">
    {/* Image Container */}
    <div className="relative aspect-[4/3] w-full overflow-hidden">
      {winery.coverPhoto ? (
        <Image
          src={winery.coverPhoto}
          alt={winery.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-burgundy-100 via-cream-100 to-burgundy-50 flex items-center justify-center">
          <WineGlassIcon className="h-16 w-16 text-burgundy-300" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {winery.isVerified && (
        <span className="absolute top-3 right-3 bg-gold-400 text-gold-900 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
          <CheckIcon className="h-3 w-3" /> Verified
        </span>
      )}
    </div>

    <CardContent className="p-5 sm:p-6">
      <h3 className="font-display text-lg font-semibold text-slate-900 group-hover:text-burgundy-700 transition-colors">
        {winery.name}
      </h3>
      <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
        <MapPinIcon className="h-3.5 w-3.5 text-burgundy-400" />
        <span>{winery.commune}</span>
        <span className="text-slate-300">·</span>
        <span>Valais</span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-600 leading-relaxed">
        {winery.description}
      </p>
      <div className="mt-4 flex items-center text-sm font-medium text-burgundy-600 group-hover:text-burgundy-700">
        Discover
        <ArrowRightIcon className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </CardContent>
  </Card>
</Link>
```

### 5.4 Input Component

**Premium Input Styling:**

```tsx
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 placeholder:italic transition-all duration-200',
        'focus:border-burgundy-400 focus:outline-none focus:ring-2 focus:ring-burgundy-500/20',
        'hover:border-stone-400',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-stone-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
```

### 5.5 Header Component

**Premium Header:**

```tsx
<header className="sticky top-0 z-50 w-full border-b border-stone-200/60 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
  <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 lg:px-8">
    <Link href="/" className="flex items-center gap-2 group">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-burgundy-600 text-white transition-colors group-hover:bg-burgundy-700">
        <WineIcon className="h-5 w-5" />
      </div>
      <span className="font-display text-2xl font-semibold text-burgundy-800">
        EnCave
      </span>
    </Link>

    <nav className="hidden md:flex items-center gap-8">
      <Link href="/wineries" className="text-sm font-medium text-slate-600 hover:text-burgundy-700 transition-colors">
        Wineries
      </Link>
    </nav>

    <div className="flex items-center gap-3">
      {/* Auth buttons */}
    </div>
  </div>
</header>
```

### 5.6 Verified Badge Component

```tsx
export function VerifiedBadge({ size = 'md', showLabel = true }: VerifiedBadgeProps) {
  const sizes = {
    sm: 'h-5 text-xs px-1.5',
    md: 'h-6 text-xs px-2',
    lg: 'h-7 text-sm px-2.5',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 text-gold-950 font-medium shadow-sm',
      sizes[size]
    )}>
      <CheckCircleIcon className="h-3.5 w-3.5" />
      {showLabel && <span>Verified</span>}
    </span>
  );
}
```

---

## 6. EPIC 1 Screen Redesigns

### 6.1 Login Page (`/login`)

**Layout:** Split-screen with atmospheric vineyard image (left) and form (right).

```
+---------------------------+---------------------------+
|     [Atmospheric          |      [Logo Mark]          |
|      vineyard photo       |       EnCave              |
|      with gradient        |                           |
|      overlay]             |   Welcome back            |
|                           |   Sign in to continue     |
|     "Discover the         |   your wine journey       |
|      finest wines         |                           |
|      of Valais"           |   [Email input]           |
|                           |   [Password input]        |
|          — EnCave         |   [Forgot password?]      |
|                           |   [Sign in button]        |
|                           |   Don't have an account?  |
|                           |   Create one →            |
+---------------------------+---------------------------+
      (hidden on mobile)           (full width mobile)
```

**Key Features:**
- Left panel with vineyard hero image + burgundy gradient overlay
- Inspirational quote at bottom of image panel
- Logo mark (wine icon in colored square) + text
- Warm cream background on form side
- Hidden left panel on mobile (full-width form)

### 6.2 Register Page (`/register`)

**Layout:** Same split-screen, different image (cellar/barrels).

**Key Features:**
- Different atmospheric image (wine cellar)
- Different inspirational quote
- Enhanced winemaker checkbox with dashed border container
- Visual feedback when checkbox is selected

### 6.3 Winery Onboarding (`/onboarding/winery`)

**Layout:** Centered form with progress indicator.

```
+----------------------------------------------------------+
| [←] Back                              Step 1 of 2        |
+----------------------------------------------------------+
|   ████████████░░░░░░░░░░░░░░░░░░░░░  50%                 |
+----------------------------------------------------------+
|        [wine glass icon in burgundy circle]              |
|              Register your winery                        |
|        Tell us about your cave and location              |
+----------------------------------------------------------+
|   ┌─────────────────────────────────────────────────┐   |
|   │  🍷  WINERY INFORMATION                         │   |
|   └─────────────────────────────────────────────────┘   |
|   [Name field with helper text]                          |
|   [Description textarea with character counter]          |
+----------------------------------------------------------+
|   ┌─────────────────────────────────────────────────┐   |
|   │  📍  LOCATION                                    │   |
|   └─────────────────────────────────────────────────┘   |
|   [Commune dropdown]                                     |
|   [Address textarea]                                     |
+----------------------------------------------------------+
|   ┌─────────────────────────────────────────────────┐   |
|   │  📞  CONTACT                                     │   |
|   └─────────────────────────────────────────────────┘   |
|   [Phone field]                                          |
+----------------------------------------------------------+
|   [Continue button]                                      |
+----------------------------------------------------------+
```

**Key Features:**
- Animated progress bar
- Section headers with icons in colored containers
- Character counter with success state
- Grouped form sections with visual separation

### 6.4 Onboarding Confirmation (`/onboarding/confirmation`)

**Layout:** Centered success state with timeline.

**Key Features:**
- Animated success checkmark with glow effect
- Numbered timeline showing next steps
- Email confirmation callout box
- Return to homepage button

### 6.5 Winery Directory (`/wineries`)

**Layout:** Hero header + filter bar + card grid.

```
+----------------------------------------------------------+
|  ░░░░░░░░░░ [Full-width hero image] ░░░░░░░░░░░░░░░░░░  |
|         [gradient overlay from bottom]                   |
|              Wineries in Valais                          |
|       Discover the finest winemakers in the region       |
+----------------------------------------------------------+
|   Filter by commune: [Dropdown]    Showing 12 wineries   |
+----------------------------------------------------------+
|   [WineryCard]  [WineryCard]  [WineryCard]               |
|   [WineryCard]  [WineryCard]  [WineryCard]               |
+----------------------------------------------------------+
```

**Key Features:**
- Full-bleed hero with Valais vineyard image
- Burgundy gradient overlay from bottom
- Sticky filter bar with backdrop blur
- Staggered card entrance animations
- Enhanced WineryCard with hover effects

### 6.6 Winery Detail Page (`/wineries/[slug]`)

**Layout:** Hero cover + two-column content.

**Key Features:**
- Full-width parallax hero with cover photo
- Verified badge prominently displayed
- Name and location overlay on hero
- Two-column layout: main content + sidebar
- Contact card with hover effects on links
- "Coming Soon" booking teaser with gold accent

### 6.7 Admin Dashboard (`/admin`)

**Layout:** Stats cards + recent activity.

**Key Features:**
- KPI cards with colored left border (amber/green/red)
- Large stat numbers with labels
- Quick action links
- Recent activity table

### 6.8 Admin Pending Queue (`/admin/wineries/pending`)

**Layout:** Enhanced table with status indicators.

**Key Features:**
- Count badge in header
- Clean table with hover states
- Review action buttons
- Time-ago formatting for submitted dates

### 6.9 Admin Winery Review (`/admin/wineries/[id]`)

**Layout:** Side-by-side review layout.

**Key Features:**
- All submitted information displayed
- Approve/Reject action buttons
- Rejection reason text field (required for reject)
- Back to queue link

---

## 7. Animation & Micro-interactions

### 7.1 Motion Philosophy

| Principle | Description |
|-----------|-------------|
| **Purposeful** | Every animation serves a function |
| **Subtle** | Premium ≠ flashy. Animations feel natural |
| **Performant** | 60fps minimum. Use `transform` and `opacity` only |
| **Respectful** | Honor `prefers-reduced-motion` |

### 7.2 Animation Budget

| Animation Type | Max Duration |
|----------------|--------------|
| Micro-interactions (hovers, clicks) | 150-250ms |
| Component transitions | 200-350ms |
| Page transitions | 300-500ms |
| Loading/progress | 500ms-2s |

### 7.3 Easing Curves

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 7.4 Key Animations

**Staggered Card Grid:**
```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
};
```

**Button Hover:**
```tsx
<motion.button
  whileHover={{ scale: 1.02, boxShadow: '0 4px 20px rgba(204, 45, 85, 0.25)' }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
/>
```

**Card Hover:**
- Lift: `translateY(-4px)`
- Shadow enhancement
- Image zoom: `scale(1.05)` over 500ms
- Arrow slide: `translateX(4px)`

**Link Underline:**
```css
.link-animated::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, #f1c91d, #e1af10);
  transition: width 300ms var(--ease-out);
}
.link-animated:hover::after { width: 100%; }
```

**Page Transitions:**
```tsx
// app/template.tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
>
  {children}
</motion.div>
```

**Success Checkmark:**
- Scale from 0 with spring
- Checkmark path draws in
- Glow pulse animation

### 7.5 Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 7.6 Implementation Priority

| Priority | Animation | Effort | Impact |
|----------|-----------|--------|--------|
| **P0** | Button hover/active states | Low | High |
| **P0** | Card hover lift + shadow | Low | High |
| **P0** | Link underline animation | Low | Medium |
| **P1** | Page fade transition | Low | Medium |
| **P1** | Staggered card grid reveal | Medium | High |
| **P1** | Hero content reveal | Medium | High |
| **P2** | Progress bar animation | Low | Medium |
| **P2** | Success checkmark animation | Medium | Medium |
| **P3** | Parallax hero scroll | High | Medium |

---

## 8. Accessibility Requirements

### 8.1 Compliance Target

**Standard:** WCAG 2.1 Level AA

### 8.2 Color Contrast

| Combination | Ratio | Status |
|-------------|-------|--------|
| Body text (`slate-700`) on `cream-50` | 10.5:1 | ✅ Pass |
| Primary button (white on `burgundy-600`) | 4.8:1 | ✅ Pass |
| Link text (`burgundy-600`) on `cream-50` | 5.2:1 | ✅ Pass |
| Gold badge (`gold-950` on `gold-400`) | 7.1:1 | ✅ Pass |
| Placeholder text (`slate-400`) | 3.0:1 | ⚠️ Use `slate-500` for essential |

### 8.3 Focus Management

**Focus Ring Specification:**
```css
:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px white,
    0 0 0 4px #cc2d55;
}
```

**Skip Links:**
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only ...">
  Skip to main content
</a>
```

### 8.4 Keyboard Navigation

- All interactive elements focusable via Tab
- Enter/Space activates buttons
- Escape closes modals/dropdowns
- Arrow keys navigate dropdowns
- No keyboard traps

### 8.5 Screen Reader Support

- Semantic HTML (`<header>`, `<nav>`, `<main>`, `<footer>`)
- Proper heading hierarchy (h1 → h2 → h3)
- ARIA labels for icon buttons
- Live regions for dynamic content
- Alt text for all informative images

### 8.6 Form Accessibility

- All inputs have associated labels
- Error messages linked via `aria-describedby`
- Required fields marked with `aria-required`
- Invalid fields marked with `aria-invalid`
- Character counters use `aria-live`

### 8.7 Touch Targets

- Minimum 44×44px for all interactive elements
- Buttons: `h-11` (44px) minimum
- Icon buttons: 44×44px touch area

### 8.8 Motion Accessibility

- Respect `prefers-reduced-motion`
- No auto-playing content without controls
- No flashing content (max 3 flashes/second)

---

## 9. Implementation Checklist

### Phase 1: Foundation (Do First)

- [ ] Add Google Fonts: Playfair Display, DM Sans
- [ ] Update `tailwind.config.ts` with new font families
- [ ] Add warm neutral colors (cream, stone) to config
- [ ] Update shadow system with warm tints
- [ ] Create CSS custom properties for easings

### Phase 2: Core Components

- [ ] Update Button component with gradient and hover effects
- [ ] Update Card component with warm shadows and rounded-xl
- [ ] Update Input component with premium styling
- [ ] Create VerifiedBadge component
- [ ] Update Header with logo mark and backdrop blur
- [ ] Update EmptyState with gradient background

### Phase 3: EPIC 1 Screens

- [ ] Redesign Login page (split-screen layout)
- [ ] Redesign Register page (split-screen layout)
- [ ] Redesign Winery Onboarding (progress bar, sections)
- [ ] Redesign Onboarding Confirmation (success animation)
- [ ] Redesign Winery Directory (hero, enhanced grid)
- [ ] Redesign Winery Detail (parallax hero, sidebar)
- [ ] Redesign WineryCard component
- [ ] Update Admin pages with KPI cards

### Phase 4: Animation

- [ ] Install Framer Motion (if not present)
- [ ] Add page transition wrapper
- [ ] Add staggered card entrance animation
- [ ] Add button hover/tap animations
- [ ] Add card hover effects
- [ ] Add link underline animation
- [ ] Add reduced motion support

### Phase 5: Accessibility Audit

- [ ] Run axe-core on all pages
- [ ] Test keyboard navigation
- [ ] Test with screen reader (VoiceOver)
- [ ] Verify color contrast ratios
- [ ] Add skip links
- [ ] Test at 200% zoom

---

## Appendix: Asset Requirements

### Photography Needed

| Asset | Usage | Specifications |
|-------|-------|----------------|
| Vineyard hero | Login page left panel | 1920×1080 min, landscape |
| Cellar/barrels | Register page left panel | 1920×1080 min, landscape |
| Valais panorama | Winery directory hero | 1920×600 min, wide aspect |
| Default winery cover | Fallback for wineries | 1200×675 (16:9) |

### Icons Needed

- Wine glass (logo mark)
- Wine bottle
- Grape cluster
- Map pin (custom styled)
- Check circle (for verified)
- Calendar (for booking teaser)

---

*Document generated by Sally (UX Expert) on 2026-01-09*
