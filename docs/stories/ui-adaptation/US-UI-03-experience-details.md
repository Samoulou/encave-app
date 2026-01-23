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
- [ ] Main image (large, ~60% width on desktop)
- [ ] Thumbnail strip or grid for additional images
- [ ] Click to open lightbox/fullscreen viewer
- [ ] Image ratio: 16:9 or 3:2 for main image
- [ ] Smooth transitions between images

### AC2: Page Layout (Desktop)
- [ ] Two-column layout: Content (7 cols) | Booking Widget (5 cols)
- [ ] Max-width container: `max-w-7xl`
- [ ] Content column: Gallery, Title, Host, Tabs, Map
- [ ] Booking widget: Sticky, stays visible while scrolling

### AC3: Experience Header
- [ ] Title: `text-3xl md:text-4xl font-bold`
- [ ] Location with map pin icon
- [ ] Rating: Stars + numeric score + review count
- [ ] Quick stats row: Duration, Max Guests, Language

### AC4: Host Section
- [ ] Host avatar (rounded-full, 64px)
- [ ] Host name and title
- [ ] "Hosted by [Winery Name]"
- [ ] Brief bio or tagline
- [ ] Link to winery profile

### AC5: Tabs Navigation
- [ ] Three tabs: "Overview" | "What's Included" | "Reviews"
- [ ] Active tab: `border-b-2 border-primary text-primary`
- [ ] Smooth scroll or content switch on tab change

#### Overview Tab Content:
- [ ] Full description (rich text)
- [ ] Highlights list with icons

#### What's Included Tab Content:
- [ ] Included items with checkmark icons
- [ ] Not included items with X icons
- [ ] Additional info (accessibility, languages, etc.)

#### Reviews Tab Content:
- [ ] Overall rating summary
- [ ] Rating breakdown by category
- [ ] Individual review cards with:
  - User avatar and name
  - Date
  - Star rating
  - Review text

### AC6: Sticky Booking Widget
- [ ] Position: `sticky top-24` (accounting for header)
- [ ] Contains:
  - Price display: `CHF XX.00 / person`
  - Date picker
  - Guest selector (adults, children if applicable)
  - Price breakdown (subtotal, fees, total)
  - "Book Now" CTA button (full-width, primary)
  - Cancellation policy summary
- [ ] Card styling: `bg-white rounded-xl shadow-lg border`
- [ ] On mobile: Fixed bottom bar with price + "Book" button

### AC7: Location Section
- [ ] Map preview (static or interactive)
- [ ] Address displayed
- [ ] "Get Directions" link
- [ ] Winery name

### AC8: Similar Experiences
- [ ] Section title: "You Might Also Like"
- [ ] Horizontal carousel of 3-4 experience cards
- [ ] Same card design as listing page

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
- [ ] Gallery with lightbox functioning
- [ ] Sticky booking widget working on desktop
- [ ] Mobile bottom bar implemented
- [ ] All tabs content rendering correctly
- [ ] Reviews loading with pagination
- [ ] Map integration working
- [ ] Similar experiences carousel populated
- [ ] Visual match with mockup 90%+
- [ ] Code reviewed and merged
