# US-UI-02: Experience Listing Page UI Adaptation

## Story

**As a** visitor browsing available wine experiences,
**I want** a well-organized listing page with intuitive filters and attractive cards,
**So that** I can easily find and compare experiences that match my preferences.

---

## References

| Resource | Location |
|----------|----------|
| **Mockup PNG** | `docs/mockups/experience_listing/screen.png` |
| **Mockup Code** | `docs/mockups/experience_listing/code.html` |
| **UI Spec** | `docs/ui-adaptation-spec.md` (Section: Experience Listing) |
| **Current Page** | `src/app/[locale]/(public)/experiences/page.tsx` |

---

## Acceptance Criteria

### AC1: Page Layout
- [ ] Sidebar filters on left (desktop), drawer on mobile
- [ ] Main content area with grid of cards
- [ ] Page header with title and result count
- [ ] Background: `#f8f6f6`

### AC2: Filter Sidebar
- [ ] Collapsible sections for each filter type:
  - Experience Type (checkboxes)
  - Price Range (dual-handle slider)
  - Duration (checkboxes)
  - Rating (star selector)
- [ ] "Clear All" button at top
- [ ] Filter count badge on mobile trigger button
- [ ] Sticky positioning on desktop (within scroll bounds)

### AC3: Experience Cards Grid
- [ ] Grid layout: 3 columns (desktop), 2 columns (tablet), 1 column (mobile)
- [ ] Gap: `gap-6` (24px)
- [ ] Card design matching mockup:
  ```
  ┌─────────────────────────┐
  │ [Image 3:2 ratio]       │
  │ ┌─────┐          ┌────┐ │
  │ │Badge│          │CHF │ │
  │ └─────┘          └────┘ │
  ├─────────────────────────┤
  │ Title (font-bold)       │
  │ Location • Duration     │
  │ ★★★★☆ (4.5) · 28 reviews│
  └─────────────────────────┘
  ```

### AC4: Card Badges
- [ ] Status badges (top-left): "Popular", "New", "Trending"
  - Popular: `bg-primary text-white`
  - New: `bg-green-500 text-white`
- [ ] Price badge (top-right or bottom): `CHF XX.00`
- [ ] Badges have `backdrop-blur-sm` effect

### AC5: Card Hover Effects
- [ ] Transform: `hover:-translate-y-1`
- [ ] Shadow: `hover:shadow-[0_12px_30px_rgba(205,45,85,0.15)]`
- [ ] Image zoom: `hover:scale-105` on image container
- [ ] Transition: `transition-all duration-300`

### AC6: Sorting & Pagination
- [ ] Sort dropdown: "Recommended", "Price: Low to High", "Price: High to Low", "Rating", "Newest"
- [ ] Pagination with numbered pages (not just prev/next)
- [ ] Current page highlighted with primary color
- [ ] Show "Showing X to Y of Z results"

---

## Technical Notes

### Components to Create/Update
- `src/components/features/experience/ExperienceFilters.tsx` - Filter sidebar
- `src/components/features/experience/ExperienceCard.tsx` - Card component
- `src/components/features/experience/ExperienceGrid.tsx` - Grid layout
- `src/components/shared/Pagination.tsx` - Pagination component

### Filter State Management
```typescript
interface FilterState {
  types: ExperienceType[];
  priceRange: [number, number];
  durations: string[];
  minRating: number;
  sortBy: 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
}
```

### Price Slider Component
Consider using `@radix-ui/react-slider` for the dual-handle price range slider.

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Sidebar drawer on mobile | Better UX than inline filters for mobile |
| Numbered pagination | Mockup shows numbered pages, better for SEO |
| Card badges on hover for actions | Keep cards clean, show actions on interaction |

---

## Out of Scope
- Map view toggle (future enhancement)
- Saved/favorite functionality (separate US)
- Advanced search with multiple locations

---

## Definition of Done
- [ ] Filter functionality working for all filter types
- [ ] Cards match mockup design exactly
- [ ] Responsive layout at all breakpoints
- [ ] Pagination updates URL for shareable links
- [ ] Performance: page loads under 2s with 20+ cards
- [ ] Code reviewed and merged
