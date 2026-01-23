# US-UI-01: Homepage UI Adaptation

## Story

**As a** visitor discovering EnCave for the first time,
**I want** a visually stunning and intuitive homepage that matches the brand identity,
**So that** I immediately understand the value proposition and can easily search for wine experiences.

---

## References

| Resource | Location |
|----------|----------|
| **Mockup PNG** | `docs/mockups/encave_home_page/screen.png` |
| **Mockup Code** | `docs/mockups/encave_home_page/code.html` |
| **UI Spec** | `docs/ui-adaptation-spec.md` (Section: Homepage) |
| **Current Page** | `src/app/[locale]/(public)/page.tsx` |

---

## Acceptance Criteria

### AC1: Hero Section
- [ ] Full-width hero with background image and gradient overlay (`bg-gradient-to-t from-black/60 to-transparent`)
- [ ] Main heading uses Manrope font, `text-4xl md:text-5xl font-extrabold`
- [ ] Subheading in `text-lg text-white/90`
- [ ] Minimum height: 500px on desktop, 400px on mobile

### AC2: Search Bar
- [ ] Search bar prominently placed in hero section
- [ ] Location input with autocomplete functionality (already implemented in US 12.3)
- [ ] Date picker integrated inline
- [ ] Search button with primary styling (`bg-primary hover:bg-[#a62444]`)
- [ ] On mobile: inputs stack vertically

### AC3: Featured Experiences Section
- [ ] Section title: "Featured Experiences" with `text-2xl font-bold`
- [ ] Horizontal scrolling carousel on mobile
- [ ] Grid of 3-4 cards on desktop
- [ ] Experience cards match mockup design:
  - Image ratio 3:2
  - Price badge top-right
  - Title, location, duration, rating visible
  - Hover effect: `scale(1.02)` + elevated shadow

### AC4: Region Filter Section
- [ ] Circular region images (clickable)
- [ ] Region names below each image
- [ ] Horizontal scroll on mobile
- [ ] Click navigates to filtered experience listing

### AC5: Visual Consistency
- [ ] Background color: `#f8f6f6`
- [ ] All text uses Manrope font
- [ ] Primary color: `#cd2d55`
- [ ] Border colors: `#e5d2d7`
- [ ] Section spacing: `py-16` (64px)

---

## Technical Notes

### Font Migration
```typescript
// tailwind.config.ts
fontFamily: {
  display: ["Manrope", "sans-serif"],
  sans: ["Manrope", "sans-serif"],
}
```

### Key Components to Update
- `src/components/features/home/` - All homepage components
- `src/components/features/search/` - Search bar components
- `src/components/shared/ExperienceCard.tsx` - Card component

### Mockup Code Reference
The mockup HTML at `docs/mockups/encave_home_page/code.html` contains exact Tailwind classes to use. Cross-reference with the spec for any adjustments needed for React/Next.js.

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Keep Lucide React icons | Consistency with existing codebase, similar aesthetic |
| Use existing search autocomplete | Already implemented in US 12.3, just needs styling update |
| Horizontal scroll for regions | Better mobile UX than wrapping grid |

---

## Out of Scope
- Dark mode (will be addressed in future US)
- Footer redesign (separate US if needed)
- Newsletter signup (assess need separately)

---

## Definition of Done
- [ ] Visual match with mockup at 90%+ fidelity
- [ ] Responsive at all breakpoints (mobile, tablet, desktop)
- [ ] Lighthouse performance score maintained
- [ ] No accessibility regressions
- [ ] Code reviewed and merged
