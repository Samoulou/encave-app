# Story DS-7: Animations & Micro-interactions

## Status

Ready for Dev

## PM Validation

| Criteria | Status |
|----------|--------|
| Clear user story | ✅ |
| Numbered ACs | ✅ 24 ACs |
| Technical notes | ✅ Code examples + CSS |
| Files identified | ✅ 6 files |
| Dependencies | ✅ DS-1 |
| Effort estimate | ✅ Medium (4-8h) |
| UX Spec reference | ✅ Section 7 |

**Validated by:** John (PM Agent) on 2026-01-09

## Story

**As a** user,
**I want** subtle animations that reward my interactions,
**so that** the platform feels alive, responsive, and premium.

## Acceptance Criteria

### Setup
1. Framer Motion installed and configured
2. CSS custom properties for easing curves added
3. Reduced motion support implemented (`prefers-reduced-motion`)

### Button Animations
4. Hover: slight scale up (1.02) + enhanced shadow
5. Active/tap: scale down (0.98)
6. Transition uses spring physics

### Card Animations
7. Hover: lift (`translateY(-4px)`) + shadow enhancement
8. Image zoom on card hover (`scale-1.05` over 500ms)
9. Arrow icon slides right on hover

### Link Animations
10. Gold underline grows from left on hover
11. Underline uses gradient (gold-400 to gold-500)
12. Animation duration 300ms

### Page Transitions
13. Template wrapper with fade + slight y-axis movement
14. Duration 300ms with custom easing

### Staggered Grid Animation
15. Cards animate in with stagger effect (80ms delay between items)
16. Individual card: fade in + slide up + slight scale
17. Uses spring physics for natural feel

### Onboarding Animations
18. Progress bar animates width changes smoothly
19. Success checkmark scales in with spring
20. Checkmark path draws in (SVG line animation)
21. Success glow pulse animation

### Performance
22. All animations use transform and opacity only (GPU accelerated)
23. Animations maintain 60fps
24. No layout thrashing

## Technical Notes

Reference: `docs/epic-1-premium-redesign-spec.md` Section 7

### Easing Curves

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Staggered Animation Example

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

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Files to Create/Modify

- `package.json` - add framer-motion
- `src/app/globals.css` - easing curves, reduced motion
- `src/app/template.tsx` - page transitions
- `src/components/ui/button.tsx` - motion wrapper
- `src/components/features/winery/WineryCard.tsx` - hover effects
- `src/components/shared/AnimatedGrid.tsx` - new component for staggered grids

## Dependencies

- DS-1 (Design System Foundation)

## Effort Estimate

Medium (4-8 hours)

## Change Log

| Date       | Version | Description            | Author   |
| ---------- | ------- | ---------------------- | -------- |
| 2026-01-09 | 1.0     | Initial story creation | PM Agent |
