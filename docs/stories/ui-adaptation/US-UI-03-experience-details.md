# US-UI-03: Experience Details & Booking Page UI Adaptation

## Story

**As a** visitor interested in a specific wine experience,
**I want** a comprehensive details page with all relevant information and easy booking,
**So that** I can make an informed decision and book seamlessly.

---

## References

| Resource | Location |
|----------|----------|
| **Mockup PNG** | `docs/mockups/experience_details_&_booking/screen.png` |
| **Mockup Code** | `docs/mockups/experience_details_&_booking/code.html` |
| **UI Spec** | `docs/ui-adaptation-spec.md` (Section: Experience Details) |
| **Current Page** | `src/app/[locale]/(public)/experiences/[slug]/page.tsx` |

---

## Acceptance Criteria

### AC1: Photo Gallery
- [x] Main image (large, ~60% width on desktop)
- [x] Thumbnail strip or grid for additional images
- [x] Click to open lightbox/fullscreen viewer
- [x] Image ratio: 16:9 or 3:2 for main image
- [x] Smooth transitions between images

### AC2: Page Layout (Desktop)
- [x] Two-column layout: Content (8 cols) | Booking Widget (4 cols)
- [x] Max-width container: `max-w-[1280px]`
- [x] Content column: Gallery, Title, Quick Facts, About, Included, Map
- [x] Booking widget: Sticky, stays visible while scrolling

### AC3: Experience Header
- [x] Title: `text-3xl md:text-4xl lg:text-5xl font-extrabold`
- [x] Location with map pin icon
- [x] Rating: Stars + numeric score + review count
- [x] Quick stats row: Duration, Max Guests, Language

### AC4: Host Section
- [x] Winery name link (links to winery profile)
- [ ] Host avatar (rounded-full, 64px) - N/A per mockup design
- [ ] Host name and title - N/A per mockup design
- [ ] Brief bio or tagline - N/A per mockup design

### AC5: Tabs Navigation
- [ ] Three tabs: "Overview" | "What's Included" | "Reviews" - Replaced with sections
- [x] About section with full description
- [x] What's Included section with checkmark icons

#### Overview Tab Content:
- [x] Full description (rich text)
- [x] Highlights list with icons (via QuickFacts component)

#### What's Included Tab Content:
- [x] Included items with checkmark icons
- [ ] Not included items with X icons - Not in mockup
- [ ] Additional info (accessibility, languages, etc.)

#### Reviews Tab Content:
- [ ] Overall rating summary - Future feature
- [ ] Rating breakdown by category - Future feature
- [ ] Individual review cards - Future feature (no review data model)

### AC6: Sticky Booking Widget
- [x] Position: `sticky top-28` (accounting for header)
- [x] Contains:
  - [x] Price display: `CHF XX.00 / person`
  - [x] Date picker placeholder
  - [x] Guest selector (adults)
  - [x] Price breakdown (total)
  - [x] "Book Now" CTA button (full-width, primary)
  - [x] Cancellation policy summary
- [x] Card styling: `bg-white rounded-2xl shadow-lg`
- [x] On mobile: Fixed bottom bar with price + "Book" button

### AC7: Location Section
- [x] Map preview (interactive iframe)
- [x] Address displayed
- [x] Map clickable to get directions
- [x] Parking and transit info icons

### AC8: Similar Experiences
- [x] Section: "Related Experiences" (via existing RelatedExperiencesSection)
- [x] Grid of experience cards
- [x] Same card design as listing page

---

## Technical Notes

### Components to Create/Update
- `src/components/features/experience/ExperienceGallery.tsx`
- `src/components/features/experience/ExperienceHeader.tsx`
- `src/components/features/experience/ExperienceTabs.tsx`
- `src/components/features/experience/BookingWidget.tsx`
- `src/components/features/experience/HostSection.tsx`
- `src/components/features/experience/ReviewList.tsx`
- `src/components/features/experience/SimilarExperiences.tsx`

### Sticky Widget Implementation
```tsx
<aside className="lg:col-span-5">
  <div className="sticky top-24">
    <BookingWidget experience={experience} />
  </div>
</aside>
```

### Mobile Booking Bar
```tsx
{/* Fixed bottom bar on mobile */}
<div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
  <div className="flex items-center justify-between">
    <div>
      <span className="text-lg font-bold">CHF {price}</span>
      <span className="text-sm text-gray-500"> / person</span>
    </div>
    <Button className="bg-primary">Book Now</Button>
  </div>
</div>
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Tabs instead of accordion | Mockup shows tabs, cleaner for desktop |
| Sticky booking widget | Critical UX - always accessible CTA |
| Fixed bottom bar on mobile | Common pattern for booking apps |

---

## Out of Scope
- Real-time availability checking (may be separate feature)
- Wishlist/save functionality
- Share functionality

---

## Definition of Done
- [x] Gallery with lightbox functioning
- [x] Sticky booking widget working on desktop
- [x] Mobile bottom bar implemented
- [x] About and What's Included sections rendering correctly
- [ ] Reviews loading with pagination - Future feature (no review data model)
- [x] Map integration working
- [x] Related experiences section populated
- [x] Visual match with mockup 90%+
- [ ] Code reviewed and merged

---

## Dev Agent Record

### Status
**In Progress** - Core UI implementation complete. Reviews feature pending (requires data model).

### Agent Model Used
Claude Opus 4.5

### File List
| File | Action |
|------|--------|
| `src/app/[locale]/(public)/experiences/[slug]/page.tsx` | Modified - Restructured layout to match mockup |
| `src/components/features/experience/ExperienceDetailHeader.tsx` | Created - Title, winery link, rating, location |
| `src/components/features/experience/ExperienceDetailGallery.tsx` | Created - Grid layout with lightbox |
| `src/components/features/experience/QuickFacts.tsx` | Created - Duration, guests, language chips |
| `src/components/features/experience/AboutSection.tsx` | Created - Description section |
| `src/components/features/experience/WhatsIncluded.tsx` | Created - Checkmark items list |
| `src/components/features/experience/BookingWidget.tsx` | Created - Sticky booking with date/time/guests |
| `src/components/features/experience/MobileBookingBar.tsx` | Created - Fixed bottom bar for mobile |
| `src/components/features/experience/LocationSection.tsx` | Modified - Updated styling to match mockup |

### Change Log
- 2026-01-23: Initial implementation of US-UI-03
  - Created new page layout matching mockup design
  - Implemented photo gallery with 2x2+1 grid and lightbox
  - Added ExperienceDetailHeader with title, winery link, rating, location
  - Added QuickFacts chips for duration, guests, languages, type
  - Created AboutSection and WhatsIncluded components
  - Created BookingWidget with sticky positioning, date/time/guests selectors
  - Created MobileBookingBar for mobile devices
  - Updated LocationSection with improved styling and clickable map

### Completion Notes
- Tabs navigation replaced with scroll-based sections per simpler mockup design
- Reviews feature not implemented - requires review data model (future story)
- Host section simplified to winery link - no host avatar in mockup
- Date picker in BookingWidget is placeholder - actual selection happens on book page

### Debug Log References
- None - Implementation completed without errors
