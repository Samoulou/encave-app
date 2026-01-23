# US-UI-00: Design System Migration (Foundation)

## Story

**As a** development team preparing for UI adaptation,
**I want** the foundational design system updated to match the mockups,
**So that** all subsequent UI work builds on the correct typography, colors, and base styles.

---

## Priority: CRITICAL - Must be completed FIRST

This US must be completed before any other UI adaptation stories (US-UI-01 through US-UI-10) can begin. It establishes the design foundation.

---

## References

| Resource | Location |
|----------|----------|
| **UI Spec** | `docs/ui-adaptation-spec.md` |
| **Mockup Code (any)** | `docs/mockups/*/code.html` - All contain Tailwind config |
| **Current Config** | `tailwind.config.ts` |
| **Global Styles** | `src/app/globals.css` |

---

## Acceptance Criteria

### AC1: Typography Migration to Manrope

#### Update Tailwind Config
- [x] Remove Playfair Display and DM Sans references
- [x] Add Manrope as primary font
- [x] Configure font weights: 400, 500, 600, 700, 800

```typescript
// tailwind.config.ts
fontFamily: {
  display: ["Manrope", "sans-serif"],
  sans: ["Manrope", "sans-serif"],
  mono: ["JetBrains Mono", "monospace"], // Keep for code
}
```

#### Update Font Import
- [x] Update Google Fonts link in layout.tsx:
```tsx
import { Manrope, JetBrains_Mono } from 'next/font/google';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
});
```

#### Remove Old Font References
- [x] Remove any hardcoded Playfair/DM Sans references
- [x] Update body class to use new font variable

### AC2: Color Palette Update

#### Primary Colors
- [x] Update `--primary` to `#cd2d55`
- [x] Add `--primary-hover` as `#a62444`
- [x] Ensure all primary color usages are via CSS variable

#### Background Colors
- [x] Add `--background-light`: `#f8f6f6`
- [x] Add `--background-dark`: `#201216` (for future dark mode)
- [x] Add `--surface-light`: `#ffffff`
- [x] Add `--surface-dark`: `#2a1a20`

#### Text Colors
- [x] Add `--text-main`: `#1a0f12`
- [x] Add `--text-secondary`: `#915564`

#### Border Colors
- [x] Add `--border-light`: `#e5d2d7`
- [x] Add `--border-dark`: `#4a2a32`

#### Status Colors
- [x] Verify `--success`: `#047857`
- [x] Verify `--warning`: `#b45309`
- [x] Verify `--error`: `#991b1b`

### AC3: Update globals.css

```css
@layer base {
  :root {
    /* Primary */
    --primary: 205 45 85; /* #cd2d55 in RGB for Tailwind */
    --primary-hover: 166 36 68;

    /* Backgrounds */
    --background: 248 246 246; /* #f8f6f6 */
    --surface: 255 255 255;

    /* Text */
    --text-main: 26 15 18; /* #1a0f12 */
    --text-secondary: 145 85 100; /* #915564 */

    /* Borders */
    --border: 229 210 215; /* #e5d2d7 */

    /* Status */
    --success: 4 120 87;
    --warning: 180 83 9;
    --error: 153 27 27;
  }
}
```

### AC4: Update Base Component Styles

#### Button Component
- [x] Update `src/components/ui/button.tsx` default variant
- [x] Primary: `bg-primary hover:bg-[#a62444]`
- [x] Shadow: `shadow-lg shadow-primary/20`

#### Input Component
- [x] Update `src/components/ui/input.tsx`
- [x] Border: `border-[#e5d2d7]`
- [x] Background: `bg-[#fbf9f9]`
- [x] Focus: `focus:border-primary focus:ring-2 focus:ring-primary/20`
- [x] Height: `h-12` (48px)

#### Card Component
- [x] Update `src/components/ui/card.tsx`
- [x] Border: `border-[#e5d2d7]`
- [x] Background: `bg-white`
- [x] Radius: `rounded-xl`

### AC5: Shadow Utilities

Add custom shadows to Tailwind config:
```typescript
boxShadow: {
  'card': '0 4px 20px rgba(0, 0, 0, 0.05)',
  'card-hover': '0 12px 30px rgba(205, 45, 85, 0.15)',
  'primary': '0 4px 14px rgba(205, 45, 85, 0.2)',
}
```

### AC6: Verify Icon System

- [x] Confirm Lucide React is properly configured
- [x] Verify default icon sizes:
  - Inline text: 18px (`h-[18px] w-[18px]`)
  - Buttons: 20px (`h-5 w-5`)
  - Navigation: 24px (`h-6 w-6`)
- [x] Update any hardcoded icon colors to use `currentColor` or `text-[#915564]`

### AC7: Border Radius Scale

Verify/update border radius in config:
```typescript
borderRadius: {
  DEFAULT: '0.25rem', // 4px
  lg: '0.5rem',       // 8px
  xl: '0.75rem',      // 12px
  '2xl': '1rem',      // 16px
  full: '9999px',
}
```

### AC8: Spacing Verification

Ensure standard Tailwind spacing scale is used:
- [x] Section padding: `py-16` (64px)
- [x] Card padding: `p-6` (24px) or `p-8` (32px)
- [x] Input height: `h-12` (48px)
- [x] Button height: `h-10` (40px) default, `h-12` (48px) large, `h-14` (56px) CTA

---

## Technical Notes

### Files to Modify

1. `tailwind.config.ts` - Theme configuration
2. `src/app/globals.css` - CSS variables
3. `src/app/layout.tsx` - Font imports
4. `src/components/ui/button.tsx` - Button variants
5. `src/components/ui/input.tsx` - Input styles
6. `src/components/ui/card.tsx` - Card styles
7. `src/lib/utils.ts` - Verify cn() function works with new classes

### Testing Checklist

After migration, verify:
- [x] Homepage renders with Manrope font
- [x] All buttons use new primary color
- [x] All inputs have correct styling
- [x] Cards have correct borders and shadows
- [x] No visual regressions on existing pages
- [x] Dark mode tokens prepared (not active yet)

### Rollback Plan

Keep old styles in a backup branch. If issues arise:
1. Revert tailwind.config.ts
2. Revert globals.css
3. Revert font imports

---

## Definition of Done

- [x] Manrope font loads correctly across all pages
- [x] Primary color updated to `#cd2d55`
- [x] All CSS variables defined in globals.css
- [x] Button component updated
- [x] Input component updated
- [x] Card component updated
- [x] No console errors related to fonts
- [x] Visual verification on key pages:
  - [x] Homepage
  - [x] Experience listing
  - [x] Dashboard
- [ ] Code reviewed and merged
- [ ] Team notified of design system changes

---

## Dev Agent Record

### Status: Ready for Review

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

| File | Action |
|------|--------|
| `tailwind.config.ts` | Modified - Updated fonts to Manrope, added custom shadows, updated border radius scale |
| `src/app/globals.css` | Modified - Updated CSS variables for new color palette, added dark mode tokens |
| `src/app/[locale]/layout.tsx` | Modified - Changed font imports from Playfair/DM Sans to Manrope |
| `src/components/ui/button.tsx` | Modified - Updated variants to use semantic color tokens and new shadows |
| `src/components/ui/input.tsx` | Modified - Updated styling with h-12 height, semantic colors, new focus states |
| `src/components/ui/card.tsx` | Modified - Updated to use semantic shadow and border tokens |

### Debug Log References
None - No debugging issues encountered.

### Completion Notes
- Successfully migrated typography from Playfair Display + DM Sans to Manrope
- Updated color palette to match mockup spec (#cd2d55 primary, #f8f6f6 background, etc.)
- All components now use semantic CSS variables instead of hardcoded colors
- Dark mode tokens prepared in globals.css for future implementation
- Build compiles successfully; lint and type-check pass
- Pre-existing test failures unrelated to this story (validator schemas, unstable_cache mocking)

### Change Log
| Date | Change |
|------|--------|
| 2026-01-23 | Initial implementation of design system migration |
