# US-UI-06: Secure Checkout Page UI Adaptation

## Story

**As a** visitor ready to book an experience,
**I want** a secure and trustworthy checkout process,
**So that** I can complete my booking with confidence.

---

## References

| Resource | Location |
|----------|----------|
| **Mockup PNG** | `docs/mockups/secure_checkout/screen.png` |
| **Mockup Code** | `docs/mockups/secure_checkout/code.html` |
| **UI Spec** | `docs/ui-adaptation-spec.md` (Section: Secure Checkout) |
| **Current Page** | `src/app/[locale]/(public)/experiences/[slug]/checkout/page.tsx` |

---

## Acceptance Criteria

### AC1: Simplified Header
- [x] Minimal header with EnCave logo only
- [x] "Secure Checkout" badge with lock icon
- [x] Badge styling: `bg-[#f2e9eb] text-[#915564] rounded-full px-3 py-1.5`
- [x] No main navigation (focused experience)

### AC2: Page Layout
- [x] Desktop: Two columns - Form (7 cols) | Summary (5 cols)
- [x] Mobile: Stacked - Summary collapsible at top, Form below
- [x] Max-width: `max-w-7xl`
- [x] Background: `#f8f6f6`

### AC3: Contact Details Section
- [x] Section card with white background, rounded corners, border
- [x] Section icon + title: "Contact Details"
- [x] Fields in 2-column grid:
  - First Name | Last Name (side by side)
  - Email Address (full width)
  - Phone Number (full width, with country code)
- [x] All inputs use standard styling from spec

### AC4: Payment Method Section
- [x] Section card matching contact details style
- [x] Section icon + title: "Payment Method"
- [x] Card brand icons (Visa, Mastercard) in header
- [x] Stripe Elements integration:
  - Card number input with card icon
  - Expiry (MM/YY) | CVC (side by side in same row)
  - Cardholder Name input
- [x] Combined card input styling (mockup shows single row)

### AC5: Trust Badge
- [x] Centered below payment form
- [x] Lock icon + "Secure payment processed by Stripe"
- [x] Subtle background: `bg-[#f2e9eb]/50`
- [x] Border: dashed or solid light

### AC6: CTA Button
- [x] Full-width primary button
- [x] Text: "Confirm and Pay CHF XXX.XX"
- [x] Arrow icon on hover
- [x] Height: `h-14` (56px)
- [x] Shadow: `shadow-lg shadow-primary/20`
- [x] Terms text below: "By confirming, you agree to EnCave's Terms..."

### AC7: Order Summary (Sticky)
- [x] Card with experience image at top (with gradient overlay)
- [x] Experience title over image
- [x] Details list:
  - Date & time (calendar icon)
  - Number of guests (group icon)
  - Location (map pin icon)
- [x] Price breakdown:
  - Price x Guests = Subtotal
  - Service Fee (if any)
  - **Total (CHF)** in bold, primary color
- [x] Cancellation policy note at bottom
- [x] Desktop: `sticky top-24`

### AC8: Trust Signals
- [x] Below summary card: "SSL ENCRYPTED" | "24/7 SUPPORT" badges
- [x] Subtle styling: `opacity-50 grayscale hover:grayscale-0`

### AC9: Mobile Adaptations
- [x] Summary as collapsible accordion at top
- [x] Show total prominently
- [x] Expand to see full details
- [x] CTA button fixed at bottom or within scroll

---

## Technical Notes

### Components to Create/Update
- `src/app/[locale]/(public)/experiences/[slug]/checkout/page.tsx`
- `src/components/features/checkout/CheckoutForm.tsx`
- `src/components/features/checkout/ContactDetailsSection.tsx`
- `src/components/features/checkout/PaymentSection.tsx`
- `src/components/features/checkout/OrderSummary.tsx`
- `src/components/features/checkout/TrustBadges.tsx`

### Stripe Elements Styling
```typescript
const stripeElementsOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1a0f12',
      '::placeholder': {
        color: '#915564',
        opacity: 0.6,
      },
    },
    invalid: {
      color: '#991b1b',
    },
  },
};
```

### Combined Card Input Layout
```tsx
<div className="flex items-center border border-[#e5d2d7] rounded-lg bg-[#fbf9f9] px-4 h-12">
  <CreditCard className="text-[#915564] mr-3" />
  <CardNumberElement className="flex-1" />
  <CardExpiryElement className="w-20 border-l border-[#e5d2d7] pl-2" />
  <CardCvcElement className="w-16 border-l border-[#e5d2d7] pl-2" />
</div>
```

### Sticky Summary Implementation
```tsx
<aside className="lg:col-span-5">
  <div className="sticky top-24">
    <OrderSummary booking={bookingDetails} />
    <TrustBadges />
  </div>
</aside>
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Simplified header | Reduces distractions, focuses on conversion |
| Sticky summary | Always visible price/details while filling form |
| Combined card input | Matches mockup, modern Stripe pattern |
| Trust badges | Increases conversion confidence |

---

## Out of Scope
- Alternative payment methods (TWINT, PayPal)
- Promo code input (future enhancement)
- Guest checkout vs. logged-in distinction

---

## Definition of Done
- [x] Layout matches mockup (2-column desktop, stacked mobile)
- [x] Contact form captures all required fields
- [x] Stripe Elements integrated and styled
- [x] Order summary displays correct booking details
- [x] Payment processing works end-to-end
- [x] Error handling for failed payments
- [x] Loading states during processing
- [x] Visual match with mockup 90%+
- [ ] Code reviewed and merged

---

## Dev Agent Record

### Status
Ready for Review

### Agent Model Used
Claude Opus 4.5

### File List
| File | Action |
|------|--------|
| `src/app/[locale]/(public)/experiences/[slug]/checkout/page.tsx` | Modified |
| `src/components/features/checkout/CheckoutHeader.tsx` | Created |
| `src/components/features/checkout/ContactDetailsSection.tsx` | Created |
| `src/components/features/checkout/PaymentSection.tsx` | Created |
| `src/components/features/checkout/OrderSummary.tsx` | Created |
| `src/components/features/checkout/MobileOrderSummary.tsx` | Created |
| `src/components/features/checkout/TrustBadges.tsx` | Created |
| `src/components/features/checkout/index.ts` | Modified |
| `src/server/actions/booking.ts` | Modified |
| `messages/en.json` | Modified |
| `messages/fr.json` | Modified |
| `messages/de.json` | Modified |
| `tests/e2e/pages/checkout.page.ts` | Modified |

### Completion Notes
- Implemented secure checkout page with new mockup-based UI design
- Added simplified checkout header with EnCave logo and "Secure Checkout" badge
- Created ContactDetailsSection with split First Name / Last Name fields
- Created Payment Method section with combined card input styling (card number, expiry, CVC in one row)
- Created OrderSummary with experience image, details list, and price breakdown
- Created TrustBadges component with SSL/Support indicators
- Added MobileOrderSummary collapsible accordion for mobile view
- Updated ExperienceForBooking interface to include winery commune
- Added all necessary translations for EN, FR, DE locales
- Updated E2E page object to support new form structure

### Change Log
| Date | Change |
|------|--------|
| 2026-01-23 | Initial implementation of US-UI-06 |
