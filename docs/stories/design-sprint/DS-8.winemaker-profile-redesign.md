# Story DS-8: Winemaker Profile Management Redesign

## Status

Ready for Dev

## PM Validation

| Criteria | Status |
|----------|--------|
| Clear user story | ✅ |
| Numbered ACs | ✅ 25 ACs |
| Technical notes | ✅ Reference to spec |
| Files identified | ✅ 3 files |
| Dependencies | ✅ DS-1, DS-2 |
| Effort estimate | ✅ Medium (4-8h) |
| UX Spec reference | ✅ General component styles |

**Validated by:** John (PM Agent) on 2026-01-09

## Story

**As a** verified winemaker,
**I want** my profile management page to feel professional and easy to use,
**so that** I can confidently present my winery to visitors.

## Acceptance Criteria

### Profile Page (`/dashboard/winery/profile`)
1. Page header with winery name using `font-display`
2. "View public profile" button prominently placed
3. Last updated timestamp displayed elegantly
4. Verified status badge shown

### Form Layout
5. Form divided into clear sections:
   - Cover Photo
   - Gallery Photos
   - Winery Information
   - Contact Details
6. Section headers use consistent styling
7. Generous spacing between sections (`space-y-10`)
8. Form max-width constrained for readability

### Cover Photo Section
9. Large preview area showing current cover photo
10. Overlay with "Change photo" button on hover
11. 16:9 aspect ratio guidance shown
12. Fallback gradient when no photo

### Gallery Section
13. Grid showing up to 6 photos
14. Each photo has remove button on hover
15. Add photo button in empty slots
16. Visual feedback during upload
17. Drag handle icons for future reordering

### Image Upload
18. Upload component uses premium styling
19. Progress indicator during upload
20. Success/error states clearly shown
21. File type and size requirements displayed

### Save Actions
22. Save button uses premium Button styling
23. Loading state during save
24. Success toast uses warm styling
25. Unsaved changes warning if navigating away

## Technical Notes

Reference: `docs/epic-1-premium-redesign-spec.md` (general component styles)

### Files to Modify

- `src/app/(protected)/dashboard/winery/profile/page.tsx`
- `src/components/features/winery/WineryProfileForm.tsx`
- `src/components/shared/ImageUpload.tsx`

## Dependencies

- DS-1 (Design System Foundation)
- DS-2 (Core Components)

## Effort Estimate

Medium (4-8 hours)

## Change Log

| Date       | Version | Description            | Author   |
| ---------- | ------- | ---------------------- | -------- |
| 2026-01-09 | 1.0     | Initial story creation | PM Agent |
