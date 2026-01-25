# EnCave UI Adaptation - User Stories

This folder contains the User Stories for adapting the EnCave application UI to match the high-fidelity mockups.

---

## Overview

| US ID | Screen | Priority | Dependencies |
|-------|--------|----------|--------------|
| **US-UI-00** | Design System Migration | 🔴 CRITICAL | None - Do First |
| US-UI-01 | Homepage | 🔴 High | US-UI-00 |
| US-UI-02 | Experience Listing | 🔴 High | US-UI-00 |
| US-UI-03 | Experience Details & Booking | 🔴 High | US-UI-00 |
| US-UI-04 | User Login | 🟡 Medium | US-UI-00 |
| US-UI-05 | Create Experience Form | 🟡 Medium | US-UI-00, US-UI-08 |
| US-UI-06 | Secure Checkout | 🔴 High | US-UI-00, US-UI-03 |
| US-UI-07 | Booking Confirmation | 🔴 High | US-UI-00, US-UI-06 |
| US-UI-08 | Manage Experiences (Dashboard) | 🟡 Medium | US-UI-00 |
| US-UI-09 | Winemaker Bookings (Dashboard) | 🟡 Medium | US-UI-00 |
| US-UI-10 | Winemaker Earnings (Dashboard) | 🟡 Medium | US-UI-00 |

---

## Recommended Implementation Order

### Phase 1: Foundation
1. **US-UI-00** - Design System Migration (fonts, colors, base components)

### Phase 2: Public Pages (Visitor Journey)
2. **US-UI-01** - Homepage
3. **US-UI-02** - Experience Listing
4. **US-UI-03** - Experience Details & Booking
5. **US-UI-06** - Secure Checkout
6. **US-UI-07** - Booking Confirmation

### Phase 3: Authentication
7. **US-UI-04** - User Login

### Phase 4: Winemaker Dashboard
8. **US-UI-08** - Manage Experiences
9. **US-UI-05** - Create Experience Form
10. **US-UI-09** - Winemaker Bookings
11. **US-UI-10** - Winemaker Earnings

---

## Reference Documents

| Document | Location | Description |
|----------|----------|-------------|
| **UI Specification** | `docs/ui-adaptation-spec.md` | Complete design system spec |
| **Mockups** | `docs/mockups/` | PNG images and HTML code |

---

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Font** | Manrope | Matches mockups, modern sans-serif |
| **Icons** | Lucide React | Keep existing, similar aesthetic |
| **Dark Mode** | Deferred | Awaiting dark mode mockups |
| **Component Library** | shadcn/ui (existing) | Customize to match mockups |

---

## Key Colors

```
Primary:        #cd2d55 (Burgundy/Wine)
Primary Hover:  #a62444
Background:     #f8f6f6 (Light cream)
Surface:        #ffffff (Cards)
Text Main:      #1a0f12 (Dark)
Text Secondary: #915564 (Muted)
Border:         #e5d2d7 (Light border)
Success:        #047857 (Green)
Warning:        #b45309 (Amber)
Error:          #991b1b (Red)
```

---

## For Developers

Each User Story includes:

1. **Story** - User-centric description
2. **References** - Links to mockups and spec
3. **Acceptance Criteria** - Detailed requirements with checkboxes
4. **Technical Notes** - Code snippets and component guidance
5. **Design Decisions** - Rationale for key choices
6. **Definition of Done** - Completion checklist

**Important:** Always reference both:
- The mockup files (`docs/mockups/{screen}/`)
- The UI specification (`docs/ui-adaptation-spec.md`)

---

## Questions?

For UX/Design questions, consult the UI Specification document or raise in the project channel.
