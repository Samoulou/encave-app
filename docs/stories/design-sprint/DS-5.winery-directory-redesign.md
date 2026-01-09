# Story DS-5: Winery Directory Premium Redesign

## Status

Ready for Review

## PM Validation

| Criteria | Status |
|----------|--------|
| Clear user story | ✅ |
| Numbered ACs | ✅ 32 ACs (largest story) |
| Technical notes | ✅ Code examples |
| Files identified | ✅ 5 files |
| Dependencies | ✅ DS-1, DS-2, DS-7 |
| Effort estimate | ✅ Large (8-12h) |
| UX Spec reference | ✅ Section 5.3, 6.5 & 6.6 |
| Assets required | ✅ 3 assets listed |

**Validated by:** John (PM Agent) on 2026-01-09

## Story

**As a** visitor,
**I want** the winery directory to feel like discovering a curated collection of wine experiences,
**so that** I'm inspired to explore Valais wineries.

## Acceptance Criteria

### Directory Page (`/wineries`)
1. Full-bleed hero section with Valais vineyard panorama image
2. Hero has burgundy gradient overlay from bottom
3. Hero title "Wineries in Valais" uses `font-display text-display-lg` in white
4. Hero subtitle describes the page purpose
5. Filter bar below hero with backdrop blur effect
6. Filter bar shows count: "Showing X wineries"
7. Commune dropdown uses premium Select styling
8. Card grid: 1 col mobile, 2 cols tablet, 3 cols desktop
9. Grid gap increased to `gap-8`
10. Staggered card entrance animation on page load
11. Empty state has gradient background and illustration

### WineryCard Component
12. Card has `rounded-xl` border radius
13. Image container with `aspect-[4/3]` ratio
14. Image has hover zoom effect (`scale-105` over 500ms)
15. Gradient overlay on image (transparent to black/40 at bottom)
16. Verified badge (gold) positioned top-right on image
17. Fallback state: gradient background with wine glass icon
18. Card content padding: `p-5 sm:p-6`
19. Winery name uses `font-display`
20. Location shows pin icon + commune + "Valais"
21. Description truncated to 2 lines
22. "Discover" CTA with arrow that slides on hover
23. Card hover: lift + enhanced shadow + title color change

### Detail Page (`/wineries/[slug]`)
24. Full-width hero with cover photo
25. Name and location overlay on hero (bottom)
26. Verified badge displayed prominently
27. Two-column layout below hero: main content (left) + contact sidebar (right)
28. Description section with proper typography
29. Gallery grid if multiple photos
30. Contact card with:
    - Phone (clickable tel: link)
    - Email (clickable mailto: link)
    - Address with map link
31. "Coming soon: Book experiences" teaser card with gold accent border
32. Back to directory link

## Technical Notes

Reference: `docs/epic-1-premium-redesign-spec.md` Section 5.3, 6.5 & 6.6

### Hero Section

```tsx
<section className="relative h-[40vh] min-h-[320px] w-full">
  <Image src={heroImage} fill className="object-cover" priority />
  <div className="absolute inset-0 bg-gradient-to-t from-burgundy-950/70 via-burgundy-900/30 to-transparent" />
  <div className="absolute bottom-0 left-0 right-0 p-8">
    <h1 className="font-display text-display-lg text-white">...</h1>
  </div>
</section>
```

### Files to Modify

- `src/app/(public)/wineries/page.tsx`
- `src/app/(public)/wineries/[slug]/page.tsx`
- `src/components/features/winery/WineryCard.tsx`
- `src/components/features/winery/CommuneFilter.tsx`
- `src/components/shared/EmptyState.tsx`

### Assets Required

- Valais vineyard panorama (1920×600 min, wide aspect)
- Wine glass icon for fallback
- Map pin icon (custom styled)

## Dependencies

- DS-1 (Design System Foundation)
- DS-2 (Core Components)
- DS-7 (Animations) - for staggered card entrance

## Effort Estimate

Large (8-12 hours)

## Dev Agent Record

### Tasks

- [x] Redesign directory page with hero and filter bar (AC 1-11)
- [x] Redesign WineryCard component (AC 12-23)
- [x] Redesign winery detail page (AC 24-32)
- [x] Update EmptyState and CommuneFilter components
- [x] Run linting and tests to validate changes

### File List

| File | Action |
| ---- | ------ |
| `src/app/(public)/wineries/page.tsx` | Modified - Full hero section, sticky filter bar with backdrop blur, staggered animation |
| `src/components/features/winery/WineryCard.tsx` | Modified - Premium card with hover zoom, gradient overlay, verified badge, arrow CTA |
| `src/app/(public)/wineries/[slug]/page.tsx` | Modified - Full hero with cover photo, two-column layout, contact sidebar, gold teaser |
| `src/components/shared/EmptyState.tsx` | Modified - Gradient background, wine glass icon in burgundy circle |
| `src/components/features/winery/CommuneFilter.tsx` | Modified - Premium styling with MapPin icon, burgundy focus states |

### Agent Model Used

Claude Opus 4.5

### Debug Log References

N/A - No issues encountered

### Completion Notes

- All 32 acceptance criteria implemented (largest story in sprint)
- Directory page: Full-bleed hero with Unsplash vineyard panorama, sticky filter bar with backdrop blur, staggered entrance animations
- WineryCard: rounded-xl, aspect-[4/3] image with hover zoom (scale-105), gradient overlay, verified badge top-right, "Discover" CTA with sliding arrow
- Detail page: Full hero with cover photo or gradient fallback, verified badge, two-column layout, contact card with tel:/mailto:/maps links, gold "Coming soon" teaser
- EmptyState: Gradient background from cream to burgundy, wine glass icon in burgundy circle
- CommuneFilter: MapPin icon, premium border/shadow styling, burgundy focus states
- Used CSS animations (animate-in) as DS-7 not yet implemented - can be enhanced later
- Lint passes, TypeScript compiles, all 119 tests pass

## Change Log

| Date       | Version | Description            | Author   |
| ---------- | ------- | ---------------------- | -------- |
| 2026-01-09 | 1.0     | Initial story creation | PM Agent |
| 2026-01-09 | 1.1     | Implementation complete | Dev Agent (James) |
