# US-UI-07: Booking Confirmation Page UI Adaptation

## Story

**As a** visitor who has just completed a booking,
**I want** a clear confirmation with all booking details and next steps,
**So that** I feel confident my booking is confirmed and know what to do next.

---

## References

| Resource | Location |
|----------|----------|
| **Mockup PNG** | `docs/mockups/booking_confirmation/screen.png` |
| **Mockup Code** | `docs/mockups/booking_confirmation/code.html` |
| **UI Spec** | `docs/ui-adaptation-spec.md` (Section: Booking Confirmation) |
| **Current Page** | `src/app/[locale]/(public)/experiences/[slug]/confirmation/page.tsx` |

---

## Acceptance Criteria

### AC1: Success Header
- [x] Large animated checkmark in green circle
- [x] Animation: Draw checkmark stroke on page load
- [x] Heading: "Success! Your visit to Valais awaits."
- [x] Subtext: "We have sent a confirmation email to [email] with all the details."
- [x] Centered layout, celebratory feel

### AC2: Animated Checkmark
```css
.checkmark-circle {
  animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}
.checkmark-check {
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards;
}
@keyframes stroke {
  100% { stroke-dashoffset: 0; }
}
```

### AC3: Booking Reference Card
- [x] Card with header showing:
  - "Booking Reference" label
  - Reference number large: `#ENC-XXXX-VL` (primary color, text-2xl)
  - "Confirmed" badge (green, with checkmark icon)
- [x] Background header: subtle gray `bg-[#fcfafa]`

### AC4: Experience Details Section
- [x] Icon + "Experience Details" heading
- [x] Information displayed:
  - Experience name
  - Winery name
  - Date (formatted nicely)
  - Time (start - end)
  - Number of guests
- [x] Total Paid at bottom with "Includes taxes & service fees" note

### AC5: Visual/QR Section
- [x] Experience location image (vineyard photo)
- [x] Location badge overlay: "Valais, Switzerland"
- [x] QR Code card:
  - QR code image (generated dynamically)
  - "Check-in Ticket" label
  - Instruction: "Present this QR code upon arrival"
- [x] QR code should encode booking reference

### AC6: Action Buttons
- [x] Two buttons side by side:
  - "Add to Calendar" (primary style, calendar icon)
  - "Download Receipt" (secondary/outline style, receipt icon)
- [x] Full width on mobile (stacked)
- [x] Calendar: generates .ics file download
- [x] Receipt: generates PDF download (fallback to print dialog)

### AC7: Winery Information Card
- [x] Card title: "Winery Information"
- [x] Mini map or map placeholder with pin
- [x] Contact details:
  - Address (with icon)
  - Phone (clickable tel: link)
  - Email (clickable mailto: link)
- [x] "Get Directions" button/link

### AC8: Need to Modify Section
- [x] Subtle card with info
- [x] Text: "You can cancel or reschedule up to 24 hours before..."
- [x] "Manage Booking" link (text-primary)

### AC9: Return Navigation
- [x] Bottom of page: "Return to Experiences" link
- [x] With back arrow icon
- [x] Centered

---

## Technical Notes

### Components to Create/Update
- `src/app/[locale]/(public)/bookings/[id]/confirmation/page.tsx`
- `src/components/features/booking/ConfirmationSuccess.tsx`
- `src/components/features/booking/BookingDetails.tsx`
- `src/components/features/booking/QRCodeCard.tsx`
- `src/components/features/booking/WineryInfoCard.tsx`
- `src/components/features/booking/ConfirmationActions.tsx`

### QR Code Generation
Use `qrcode.react` or similar:
```tsx
import { QRCodeSVG } from 'qrcode.react';

<QRCodeSVG
  value={`https://encave.ch/checkin/${bookingReference}`}
  size={64}
  level="M"
/>
```

### Calendar File Generation
Already have `ics` package installed:
```typescript
import { createEvent } from 'ics';

const event = {
  start: [2023, 10, 14, 14, 0],
  duration: { hours: 2 },
  title: 'Grand Cru Tasting at Domaine du Mont d\'Or',
  description: 'Booking ref: #ENC-8294-VL',
  location: 'Route de Sion 12, 1950 Sion, Valais',
  // ...
};
```

### PDF Receipt Generation
Use existing `react-pdf` integration or server-side generation.

### Animated Checkmark Component
```tsx
const AnimatedCheckmark = () => (
  <svg className="w-20 h-20" viewBox="0 0 52 52">
    <circle
      className="checkmark-circle"
      cx="26" cy="26" r="25"
      fill="none"
      stroke="#047857"
      strokeWidth="2"
    />
    <path
      className="checkmark-check"
      d="M14.1 27.2l7.1 7.2 16.7-16.8"
      fill="none"
      stroke="#047857"
      strokeWidth="3"
    />
  </svg>
);
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Animated checkmark | Creates moment of delight, confirms success |
| QR code for check-in | Modern, contactless check-in experience |
| Map in winery card | Helps users plan their visit |
| Prominent reference number | Easy to find for customer service |

---

## Out of Scope
- Modify/cancel booking flow (separate page)
- Social sharing
- Review prompt (comes after experience)

---

## Definition of Done
- [x] Animated checkmark plays on page load
- [x] Booking reference prominently displayed
- [x] All booking details accurate from database
- [x] QR code generates correctly with booking data
- [x] "Add to Calendar" downloads valid .ics file
- [x] "Download Receipt" generates PDF (fallback to print dialog)
- [x] Winery contact info displayed with working links
- [x] Responsive layout (mobile/desktop)
- [x] Email confirmation sent (verify existing functionality)
- [x] Visual match with mockup 90%+
- [ ] Code reviewed and merged

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Status
Ready for Review

### File List
| File | Action |
|------|--------|
| `src/app/[locale]/(public)/booking/[id]/confirmation/page.tsx` | Modified |
| `src/components/features/booking/confirmation/AnimatedCheckmark.tsx` | Created |
| `src/components/features/booking/confirmation/ConfirmationSuccess.tsx` | Created |
| `src/components/features/booking/confirmation/BookingReferenceHeader.tsx` | Created |
| `src/components/features/booking/confirmation/BookingDetailsSection.tsx` | Created |
| `src/components/features/booking/confirmation/ExperienceVisual.tsx` | Created |
| `src/components/features/booking/confirmation/QRCodeCard.tsx` | Created |
| `src/components/features/booking/confirmation/WineryInfoCard.tsx` | Created |
| `src/components/features/booking/confirmation/ModifyBookingCard.tsx` | Created |
| `src/components/features/booking/confirmation/ConfirmationActions.tsx` | Created |
| `src/components/features/booking/confirmation/index.ts` | Created |
| `messages/en.json` | Modified |
| `messages/fr.json` | Modified |
| `messages/de.json` | Modified |
| `package.json` | Modified (added qrcode.react) |

### Completion Notes
- Implemented new two-column responsive layout matching mockup
- Created modular confirmation components for reusability
- Added animated SVG checkmark with CSS stroke animation
- Integrated QR code generation using qrcode.react package
- Calendar integration uses existing ICS utility
- Download Receipt currently falls back to browser print dialog (PDF generation can be enhanced later)
- Added all new translations for EN, FR, DE
- TypeScript and ESLint pass
- Build succeeds

### Change Log
| Date | Change |
|------|--------|
| 2026-01-23 | Initial implementation of US-UI-07 |

### Debug Log References
None
