# Story DS-1: Design System Foundation

## Status

Ready for Review

## PM Validation

| Criteria | Status |
|----------|--------|
| Clear user story | ✅ |
| Numbered ACs | ✅ 8 ACs |
| Technical notes | ✅ Code examples included |
| Files identified | ✅ 3 files |
| Dependencies | ✅ UX Spec only |
| Effort estimate | ✅ Small (2-4h) |
| UX Spec reference | ✅ Section 2 & 3 |

**Validated by:** John (PM Agent) on 2026-01-09

## Story

**As a** user,
**I want** the platform to have a premium, wine-inspired visual identity,
**so that** the experience feels sophisticated and worthy of Valais's world-class wines.

## Acceptance Criteria

1. Google Fonts loaded: Playfair Display (display), DM Sans (body), JetBrains Mono (mono)
2. Tailwind config updated with new font families (`font-display`, `font-sans`, `font-mono`)
3. Type scale implemented: `display-xl`, `display-lg`, `display-md` with responsive sizing
4. Warm neutral colors added: `cream-50`, `cream-100`, `cream-200`, `stone-100`, `stone-200`
5. Shadow system updated with warm burgundy-tinted shadows (`shadow-warm`, `shadow-gold`)
6. CSS custom properties added for easing curves (`--ease-out`, `--ease-in-out`, `--ease-spring`)
7. Gradient utilities added: `gradient-hero`, `gradient-gold-subtle`, `gradient-warm-bg`
8. Focus ring updated to burgundy (`ring-burgundy-500 ring-offset-2`)

## Technical Notes

### Font Loading (next/font)

```tsx
// src/app/layout.tsx
import { Playfair_Display, DM_Sans, JetBrains_Mono } from 'next/font/google';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
```

### Tailwind Config Updates

Reference: `docs/epic-1-premium-redesign-spec.md` Section 2 & 3

### Files to Modify

- `tailwind.config.ts` - fonts, colors, shadows, extend fontSize
- `src/app/layout.tsx` - font loading
- `src/app/globals.css` - CSS custom properties, gradient classes

## Dependencies

- UX Spec: `docs/epic-1-premium-redesign-spec.md`

## Effort Estimate

Small (2-4 hours)

## Dev Agent Record

### Tasks

- [x] Add Google Fonts (Playfair Display, DM Sans, JetBrains Mono) to layout.tsx
- [x] Update tailwind.config.ts with font families (font-display, font-sans, font-mono)
- [x] Add type scale (display-xl, display-lg, display-md) to tailwind.config.ts
- [x] Add warm neutral colors (cream-50/100/200, stone-100/200) to tailwind.config.ts
- [x] Add warm shadow system (shadow-warm, shadow-gold) to tailwind.config.ts
- [x] Add CSS custom properties for easing curves to globals.css
- [x] Add gradient utilities (gradient-hero, gradient-gold-subtle, gradient-warm-bg) to globals.css
- [x] Update focus ring to burgundy in globals.css
- [x] Run linting and tests to validate changes

### File List

| File | Action |
| ---- | ------ |
| `src/app/layout.tsx` | Modified - Added Google Fonts (Playfair Display, DM Sans, JetBrains Mono) |
| `tailwind.config.ts` | Modified - Added fontFamily, fontSize (display scale), colors (cream, stone), boxShadow (warm, gold) |
| `src/app/globals.css` | Modified - Added easing CSS vars, gradient utilities, focus ring, reduced motion support |

### Agent Model Used

Claude Opus 4.5

### Debug Log References

N/A - No issues encountered

### Completion Notes

- All 8 acceptance criteria implemented
- Lint passes (only pre-existing warnings)
- TypeScript compiles cleanly
- All 119 existing tests pass
- Reduced motion support added for accessibility

## Change Log

| Date       | Version | Description            | Author   |
| ---------- | ------- | ---------------------- | -------- |
| 2026-01-09 | 1.0     | Initial story creation | PM Agent |
| 2026-01-09 | 1.1     | Implementation complete | Dev Agent (James) |

## QA Results

### Review Date: 2026-01-09

### Reviewed By: Quinn (Test Architect)

### Code Quality Assessment

Implementation is excellent. All 8 acceptance criteria are properly implemented with clean, maintainable code. The design system foundation provides a solid base for the premium redesign sprint.

### Refactoring Performed

None required - implementation is clean and follows best practices.

### Compliance Check

- Coding Standards: ✓ TypeScript strict mode, proper imports, no `any` types
- Project Structure: ✓ Files in correct locations per architecture
- Testing Strategy: ✓ 119 existing tests pass, foundation is CSS/config (no new tests needed)
- All ACs Met: ✓ All 8 acceptance criteria verified

### Improvements Checklist

- [x] Google Fonts loaded correctly via next/font (Playfair Display, DM Sans, JetBrains Mono)
- [x] Tailwind config extended with font families (font-display, font-sans, font-mono)
- [x] Type scale implemented (display-xl, display-lg, display-md) with responsive sizing
- [x] Warm neutral colors added (cream-50/100/200, stone-100/200)
- [x] Shadow system with warm burgundy tints (warm-sm, warm, warm-md, warm-lg, gold)
- [x] CSS custom properties for easing curves (--ease-out, --ease-in-out, --ease-spring)
- [x] Gradient utilities (gradient-hero, gradient-gold-subtle, gradient-warm-bg)
- [x] Focus ring updated to burgundy with ring-offset-2
- [x] Bonus: Reduced motion support added for accessibility

### Security Review

No security concerns - this story involves CSS/styling only.

### Performance Considerations

- Font loading uses `display: 'swap'` for optimal performance
- CSS custom properties are efficiently defined
- No runtime overhead introduced

### Files Modified During Review

None - no modifications needed.

### Gate Status

Gate: PASS → docs/qa/gates/DS-1-foundation-design-system.yml

### Recommended Status

✓ Ready for Done
