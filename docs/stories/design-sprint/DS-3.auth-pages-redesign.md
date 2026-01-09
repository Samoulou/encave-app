# Story DS-3: Authentication Pages Premium Redesign

## Status

Ready for Dev

## PM Validation

| Criteria | Status |
|----------|--------|
| Clear user story | ✅ |
| Numbered ACs | ✅ 19 ACs |
| Technical notes | ✅ Layout diagrams |
| Files identified | ✅ 5 files |
| Dependencies | ✅ DS-1, DS-2 |
| Effort estimate | ✅ Medium (4-8h) |
| UX Spec reference | ✅ Section 6.1 & 6.2 |
| Assets required | ✅ 2 images listed |

**Validated by:** John (PM Agent) on 2026-01-09

## Story

**As a** visitor,
**I want** the login and registration pages to feel like entering a premium wine experience,
**so that** I'm excited to join the EnCave community.

## Acceptance Criteria

### Login Page (`/login`)
1. Split-screen layout: atmospheric image (left) + form (right)
2. Left panel shows vineyard hero image with burgundy gradient overlay
3. Left panel includes inspirational quote at bottom
4. Form side has warm cream background (`bg-cream-50`)
5. Logo mark (wine icon) + "EnCave" text at top of form
6. Welcome heading uses `font-display`
7. Left panel hidden on mobile (< 768px), form becomes full-width
8. "Forgot password?" link styled with gold underline on hover
9. "Create one" link at bottom with arrow icon

### Register Page (`/register`)
10. Same split-screen layout as login
11. Different atmospheric image (wine cellar/barrels)
12. Different inspirational quote
13. "I am a winemaker" checkbox in dashed border container
14. Visual feedback when winemaker checkbox is selected (background color change)
15. Password requirements shown as helper text

### Shared
16. Form inputs use premium Input styling from DS-2
17. Submit buttons use premium Button styling from DS-2
18. Smooth page transitions
19. Form max-width constrained (`max-w-md`)

## Technical Notes

Reference: `docs/epic-1-premium-redesign-spec.md` Section 6.1 & 6.2

### Layout Structure

```
Desktop (>= 768px):
+------------------+------------------+
|   Image Panel    |   Form Panel     |
|   (50% width)    |   (50% width)    |
+------------------+------------------+

Mobile (< 768px):
+----------------------------------+
|          Form Panel              |
|         (100% width)             |
+----------------------------------+
```

### Files to Modify

- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/app/(auth)/layout.tsx` - shared auth layout with split-screen
- `src/components/features/auth/LoginForm.tsx`
- `src/components/features/auth/RegisterForm.tsx`

### Assets Required

- Vineyard hero image (1920×1080 min)
- Wine cellar image (1920×1080 min)

## Dependencies

- DS-1 (Design System Foundation)
- DS-2 (Core Components)

## Effort Estimate

Medium (4-8 hours)

## Change Log

| Date       | Version | Description            | Author   |
| ---------- | ------- | ---------------------- | -------- |
| 2026-01-09 | 1.0     | Initial story creation | PM Agent |
