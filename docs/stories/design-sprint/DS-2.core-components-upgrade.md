# Story DS-2: Core Components Premium Upgrade

## Status

Ready for Dev

## PM Validation

| Criteria | Status |
|----------|--------|
| Clear user story | ✅ |
| Numbered ACs | ✅ 23 ACs |
| Technical notes | ✅ Reference to spec |
| Files identified | ✅ 5 files |
| Dependencies | ✅ DS-1 |
| Effort estimate | ✅ Medium (4-8h) |
| UX Spec reference | ✅ Section 5 |

**Validated by:** John (PM Agent) on 2026-01-09

## Story

**As a** user,
**I want** all UI components to feel premium and polished,
**so that** every interaction reinforces the quality of the EnCave brand.

## Acceptance Criteria

### Button Component
1. Primary button has subtle gradient (`from-burgundy-600 to-burgundy-700`)
2. Hover state includes shadow enhancement and slight lift (`-translate-y-0.5`)
3. Secondary variant uses warm cream background with burgundy border
4. All variants have smooth transitions (200ms)
5. Button height increased: default `h-11`, large `h-12`

### Card Component
6. Border radius increased to `rounded-xl` (12px)
7. Shadow uses warm burgundy tint
8. Hover state includes lift and enhanced shadow
9. Transition duration 250ms

### Input Component
10. Height increased to `h-11`
11. Padding increased to `px-4 py-3`
12. Focus state: `border-burgundy-400` with `ring-burgundy-500/20`
13. Placeholder text is italic
14. Hover state shows `border-stone-400`

### Header Component
15. Height increased to `h-20` (80px)
16. Logo includes wine icon mark in burgundy square
17. Logo text uses `font-display text-2xl`
18. Header has backdrop blur (`bg-white/95 backdrop-blur-md`)
19. Conditional navigation links for user roles (Admin link for ADMIN, Dashboard for WINEMAKER)

### New: VerifiedBadge Component
20. Created with gold gradient background (`from-gold-400 to-gold-500`)
21. Includes check icon
22. Three sizes: sm, md, lg
23. Dark text for contrast (`text-gold-950`)

## Technical Notes

Reference: `docs/epic-1-premium-redesign-spec.md` Section 5

### Files to Create/Modify

- `src/components/ui/button.tsx` - update variants
- `src/components/ui/card.tsx` - update styles
- `src/components/ui/input.tsx` - update styles
- `src/components/layout/Header.tsx` - redesign with logo mark
- `src/components/shared/VerifiedBadge.tsx` - new component

## Dependencies

- DS-1 (Design System Foundation)

## Effort Estimate

Medium (4-8 hours)

## Change Log

| Date       | Version | Description            | Author   |
| ---------- | ------- | ---------------------- | -------- |
| 2026-01-09 | 1.0     | Initial story creation | PM Agent |
