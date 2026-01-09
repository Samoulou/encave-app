# Story DS-8: Winemaker Profile Management Redesign

## Status

Ready for Review

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

## Tasks

- [x] Implement Profile Page header (ACs 1-4)
- [x] Implement Form Layout sections (ACs 5-8)
- [x] Implement Cover Photo Section (ACs 9-12)
- [x] Implement Gallery Section (ACs 13-17)
- [x] Implement Image Upload styling (ACs 18-21)
- [x] Implement Save Actions (ACs 22-25)
- [x] Run linting and type checks
- [x] Run all tests

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

| File | Action | Description |
| ---- | ------ | ----------- |
| `src/app/(protected)/dashboard/winery/profile/page.tsx` | Modified | Premium page header with font-display, verified badge, elegant timestamp, prominent "View Public Profile" button |
| `src/components/features/winery/WineryProfileForm.tsx` | Modified | Complete premium redesign with sectioned layout, cover photo with hover overlay, gallery grid with drag handles, contact details section, unsaved changes warning |
| `src/components/shared/ImageUpload.tsx` | Modified | Added variant prop (default, overlay, empty, gallery-add), premium styling with lucide icons, enhanced upload states |

### Debug Log References

N/A - No debug issues encountered

### Completion Notes

- All 25 acceptance criteria implemented
- Form divided into 4 clear sections: Cover Photo, Gallery Photos, Winery Information, Contact Details
- Premium section headers with icons in colored containers
- Cover photo shows large 16:9 preview with hover overlay for changing photo
- Gallery shows 6-slot grid with remove/drag buttons on hover
- ImageUpload component refactored with variant support for different contexts
- Unsaved changes warning implemented with beforeunload listener
- All toasts use warm styling (bg-cream-50 border-gold-200)
- No new dependencies added
- All 119 tests pass, build succeeds, no lint errors

## Change Log

| Date       | Version | Description            | Author   |
| ---------- | ------- | ---------------------- | -------- |
| 2026-01-09 | 1.0     | Initial story creation | PM Agent |
| 2026-01-09 | 1.1     | Implementation complete | James (Dev Agent) |
