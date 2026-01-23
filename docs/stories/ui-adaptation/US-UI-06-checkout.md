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
- [ ] Minimal header with EnCave logo only
- [ ] "Secure Checkout" badge with lock icon
- [ ] Badge styling: `bg-[#f2e9eb] text-[#915564] rounded-full px-3 py-1.5`
- [ ] No main navigation (focused experience)

### AC2: Page Layout
- [ ] Desktop: Two columns - Form (7 cols) | Summary (5 cols)
- [ ] Mobile: Stacked - Summary collapsible at top, Form below
- [ ] Max-width: `max-w-7xl`
- [ ] Background: `#f8f6f6`

### AC3: Contact Details Section
- [ ] Section card with white background, rounded corners, border
- [ ] Section icon + title: "Contact Details"
- [ ] Fields in 2-column grid:
  - First Name | Last Name (side by side)
  - Email Address (full width)
  - Phone Number (full width, with country code)
- [ ] All inputs use standard styling from spec

### AC4: Payment Method Section
- [ ] Section card matching contact details style
- [ ] Section icon + title: "Payment Method"
- [ ] Card brand icons (Visa, Mastercard) in header
- [ ] Stripe Elements integration:
  - Card number input with card icon
  - Expiry (MM/YY) | CVC (side by side in same row)
  - Cardholder Name input
- [ ] Combined card input styling (mockup shows single row)

### AC5: Trust Badge
- [ ] Centered below payment form
- [ ] Lock icon + "Secure payment processed by Stripe"
- [ ] Subtle background: `bg-[#f2e9eb]/50`
- [ ] Border: dashed or solid light

### AC6: CTA Button
- [ ] Full-width primary button
- [ ] Text: "Confirm and Pay CHF XXX.XX"
- [ ] Arrow icon on hover
- [ ] Height: `h-14` (56px)
- [ ] Shadow: `shadow-lg shadow-primary/20`
- [ ] Terms text below: "By confirming, you agree to EnCave's Terms..."

### AC7: Order Summary (Sticky)
- [ ] Card with experience image at top (with gradient overlay)
- [ ] Experience title over image
- [ ] Details list:
  - Date & time (calendar icon)
  - Number of guests (group icon)
  - Location (map pin icon)
- [ ] Price breakdown:
  - Price x Guests = Subtotal
  - Service Fee (if any)
  - **Total (CHF)** in bold, primary color
- [ ] Cancellation policy note at bottom
- [ ] Desktop: `sticky top-24`

### AC8: Trust Signals
- [ ] Below summary card: "SSL ENCRYPTED" | "24/7 SUPPORT" badges
- [ ] Subtle styling: `opacity-50 grayscale hover:grayscale-0`

### AC9: Mobile Adaptations
- [ ] Summary as collapsible accordion at top
- [ ] Show total prominently
- [ ] Expand to see full details
- [ ] CTA button fixed at bottom or within scroll

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
- [ ] Layout matches mockup (2-column desktop, stacked mobile)
- [ ] Contact form captures all required fields
- [ ] Stripe Elements integrated and styled
- [ ] Order summary displays correct booking details
- [ ] Payment processing works end-to-end
- [ ] Error handling for failed payments
- [ ] Loading states during processing
- [ ] Visual match with mockup 90%+
- [ ] Code reviewed and merged
