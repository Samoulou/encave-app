# 3. User Interface Design Goals

## 3.1 Overall UX Vision

EnCave should feel like a **premium yet approachable** wine discovery platform - sophisticated enough to reflect the quality of Valais wines, but simple enough that a tourist can book an experience in under 2 minutes. The experience should evoke the warmth of a personal invitation from a winemaker, not a sterile transaction.

**Design pillars:**

- **Simplicity:** Minimal steps from discovery to booking (3-click booking)
- **Trust:** Clear pricing, transparent policies, verified winemakers
- **Local authenticity:** Visual identity rooted in Valais terroir and wine culture
- **Dual-persona clarity:** Distinct but coherent experiences for clients vs. winemakers

## 3.2 Key Interaction Paradigms

| Paradigm                        | Description                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| **Search-first discovery**      | Homepage prominently features search (date, location, type) - inspired by Booking.com |
| **Card-based browsing**         | Experiences displayed as visual cards with photo, price, rating - scannable on mobile |
| **Linear booking flow**         | Step-by-step: Select → Configure → Pay → Confirm (no account required to browse)      |
| **Dashboard for professionals** | Winemakers get a functional admin panel - utility over aesthetics                     |
| **Progressive disclosure**      | Show essential info first, details on demand (expandable sections)                    |

## 3.3 Core Screens and Views

**Client Journey:**

1. **Homepage** - Search bar, featured experiences, regional highlights
2. **Search Results** - Filterable list/map view of experiences
3. **Experience Detail** - Full info, photos, calendar picker, booking CTA
4. **Booking Flow** - Date/participants selection → Contact info → Payment
5. **Confirmation** - Success screen + email preview
6. **My Bookings** - List of upcoming/past reservations (requires account)

**Encaveur Journey:** 7. **Registration/Onboarding** - Multi-step form with guidance 8. **Dashboard Home** - Upcoming bookings, quick stats, alerts 9. **Experience Management** - Create/edit experiences, set availability 10. **Reservation Detail** - Client info, status, actions (confirm/cancel) 11. **Payout History** - Earnings overview, transaction list

## 3.4 Accessibility

**Target: WCAG AA compliance**

- Sufficient color contrast (4.5:1 minimum)
- Keyboard navigable
- Screen reader compatible
- Form labels and error messages accessible

## 3.5 Branding

**Known elements:**

- Name: **EnCave** (play on "en cave" = in the cellar)
- Tagline: _"En Valais on fait du vin de classe mondial et on doit pouvoir le montrer!"_

**Suggested direction:**

- Color palette: Earthy tones (burgundy, warm gold, slate) evoking wine and mountains
- Typography: Modern serif for headings (elegance), clean sans-serif for body (readability)
- Imagery: Authentic photos of Valais vineyards, cellars, winemakers - no stock photos
- Tone: Warm, inviting, locally-rooted - avoid corporate/generic marketplace feel

## 3.6 Target Devices and Platforms

- **Primary:** Mobile web (tourists browsing on phones)
- **Secondary:** Desktop web (winemakers managing bookings, clients at home)
- **Breakpoints:** 320px (mobile) → 768px (tablet) → 1024px+ (desktop)
- **No native app for MVP**

---
