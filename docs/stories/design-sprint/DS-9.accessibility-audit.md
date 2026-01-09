# Story DS-9: Accessibility Audit & Fixes

## Status

Ready for Dev

## PM Validation

| Criteria | Status |
|----------|--------|
| Clear user story | ✅ |
| Numbered ACs | ✅ 35 ACs |
| Technical notes | ✅ Code examples + testing tools |
| Files identified | ✅ Multiple files |
| Dependencies | ✅ DS-1 through DS-8 |
| Effort estimate | ✅ Medium (4-8h) |
| UX Spec reference | ✅ Section 8 |

**Validated by:** John (PM Agent) on 2026-01-09

## Story

**As a** user with accessibility needs,
**I want** the platform to be fully accessible,
**so that** I can discover and book wine experiences regardless of my abilities.

## Acceptance Criteria

### Color Contrast (WCAG AA)
1. Body text on backgrounds meets 4.5:1 ratio
2. Button text meets 4.5:1 ratio
3. Link text meets 4.5:1 ratio
4. Badge text meets 4.5:1 ratio
5. Placeholder text uses `slate-500` (not `slate-400`) for essential info

### Focus Management
6. Custom focus ring: `ring-burgundy-500` with offset
7. All interactive elements have visible focus states
8. Focus order follows logical reading order
9. No keyboard traps

### Skip Links
10. "Skip to main content" link added
11. Hidden by default, visible on focus
12. Links to `#main-content` ID

### Keyboard Navigation
13. All buttons activatable with Enter/Space
14. Dropdowns navigable with arrow keys
15. Escape closes modals/dropdowns
16. Tab order is logical

### Screen Reader Support
17. Semantic HTML used (`<header>`, `<nav>`, `<main>`, `<footer>`)
18. Proper heading hierarchy (h1 → h2 → h3, no skips)
19. Icon buttons have `aria-label`
20. Form inputs have associated labels
21. Error messages linked via `aria-describedby`
22. Required fields marked with `aria-required`
23. Character counters use `aria-live`

### Images
24. All informative images have alt text
25. Decorative images have `alt=""`
26. Hero images have appropriate alt descriptions

### Touch Targets
27. All interactive elements minimum 44×44px
28. Buttons use `h-11` (44px) minimum

### Motion Accessibility
29. `prefers-reduced-motion` respected
30. No auto-playing animations
31. No flashing content

### Testing
32. axe-core audit passes on all pages
33. Keyboard navigation tested
34. Screen reader tested (VoiceOver or NVDA)
35. 200% zoom tested - no content loss

## Technical Notes

Reference: `docs/epic-1-premium-redesign-spec.md` Section 8

### Focus Ring CSS

```css
:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px white,
    0 0 0 4px #cc2d55;
}
```

### Skip Link Component

```tsx
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-burgundy-600 focus:text-white focus:rounded-lg"
    >
      Skip to main content
    </a>
  );
}
```

### Testing Tools

- axe-core DevTools extension
- Lighthouse accessibility audit
- VoiceOver (macOS) or NVDA (Windows)
- Keyboard-only navigation test

### Files to Modify

- `src/app/layout.tsx` - add SkipLink, ensure semantic structure
- `src/components/ui/*.tsx` - verify focus states
- `src/components/shared/ImageUpload.tsx` - aria labels
- All form components - ensure proper labeling

## Dependencies

- DS-1 through DS-8 (all design stories)

## Effort Estimate

Medium (4-8 hours)

## Change Log

| Date       | Version | Description            | Author   |
| ---------- | ------- | ---------------------- | -------- |
| 2026-01-09 | 1.0     | Initial story creation | PM Agent |
