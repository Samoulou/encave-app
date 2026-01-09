# Story DS-4: Winemaker Onboarding Premium Redesign

## Status

Ready for Review

## PM Validation

| Criteria | Status |
|----------|--------|
| Clear user story | ✅ |
| Numbered ACs | ✅ 20 ACs |
| Technical notes | ✅ Code examples |
| Files identified | ✅ 3 files |
| Dependencies | ✅ DS-1, DS-2, DS-7 |
| Effort estimate | ✅ Medium (4-8h) |
| UX Spec reference | ✅ Section 6.3 & 6.4 |

**Validated by:** John (PM Agent) on 2026-01-09

## Story

**As a** winemaker,
**I want** the onboarding process to feel guided and professional,
**so that** I'm confident my winery will be well-represented on the platform.

## Acceptance Criteria

### Onboarding Form (`/onboarding/winery`)
1. Centered layout with max-width container
2. Animated progress bar at top showing completion percentage
3. "Back" link in header with arrow icon
4. Step indicator: "Step 1 of 2"
5. Hero section with wine glass icon in burgundy circle
6. Page title uses `font-display text-display-md`
7. Subtitle explains purpose
8. Form divided into sections with headers:
   - "Winery Information" with wine emoji
   - "Location" with pin emoji
   - "Contact" with phone emoji
9. Section headers have colored container styling
10. Description textarea has character counter with color feedback
11. All inputs use premium styling from DS-2
12. "Continue" button full-width on mobile, constrained on desktop
13. Form sections have visual separation (spacing + subtle dividers)

### Confirmation Page (`/onboarding/winery/confirmation`)
14. Centered layout with success state
15. Animated success checkmark with glow effect
16. Congratulations heading uses `font-display`
17. Numbered timeline showing next steps:
    - Step 1: Application received
    - Step 2: Review in progress
    - Step 3: Notification of decision
18. Email confirmation callout box with gold accent
19. "Return to homepage" button
20. Expected timeline shown (e.g., "within 48 hours")

## Technical Notes

Reference: `docs/epic-1-premium-redesign-spec.md` Section 6.3 & 6.4

### Progress Bar Animation

```tsx
<motion.div
  className="h-2 bg-burgundy-600 rounded-full"
  initial={{ width: 0 }}
  animate={{ width: `${progress}%` }}
  transition={{ duration: 0.5, ease: 'easeOut' }}
/>
```

### Files to Modify

- `src/app/(protected)/onboarding/winery/page.tsx`
- `src/app/(protected)/onboarding/winery/confirmation/page.tsx`
- `src/components/features/winery/WineryOnboardingForm.tsx`

## Dependencies

- DS-1 (Design System Foundation)
- DS-2 (Core Components)
- DS-7 (Animations) - for progress bar and success checkmark

## Effort Estimate

Medium (4-8 hours)

## Dev Agent Record

### Tasks

- [x] Redesign onboarding page layout with progress bar and hero (AC 1-7)
- [x] Redesign WineryOnboardingForm with premium sections (AC 8-13)
- [x] Redesign confirmation page with success animation and timeline (AC 14-20)
- [x] Run linting and tests to validate changes

### File List

| File | Action |
| ---- | ------ |
| `src/app/(protected)/onboarding/winery/page.tsx` | Modified - Progress bar, back link, step indicator, hero section |
| `src/components/features/winery/WineryOnboardingForm.tsx` | Modified - Sections with emoji headers, character counter, visual dividers |
| `src/app/(protected)/onboarding/winery/confirmation/page.tsx` | Modified - Success checkmark with glow, timeline, gold email callout |

### Agent Model Used

Claude Opus 4.5

### Debug Log References

N/A - No issues encountered

### Completion Notes

- All 20 acceptance criteria implemented
- Onboarding form: progress bar (50%), back link, step indicator, hero with Wine icon, 3 sections (wine/location/contact) with emoji headers and colored backgrounds, character counter with color feedback
- Confirmation page: animated glow effect on success checkmark, numbered timeline with 3 steps, gold email callout box, 48 hours timeline shown
- Used CSS animations (animate-pulse) as DS-7 not yet implemented - can be enhanced later
- Lint passes, TypeScript compiles, all 119 tests pass

## Change Log

| Date       | Version | Description            | Author   |
| ---------- | ------- | ---------------------- | -------- |
| 2026-01-09 | 1.0     | Initial story creation | PM Agent |
| 2026-01-09 | 1.1     | Implementation complete | Dev Agent (James) |
