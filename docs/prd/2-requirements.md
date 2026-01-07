# 2. Requirements

## 2.1 Functional Requirements

**Client-Facing:**

- **FR1:** Users can search for wine experiences by location (region/commune), date range, and experience type (tasting, cellar visit, workshop)
- **FR2:** Search results display as a filtered list showing experience name, price, photo, average rating, and availability
- **FR3:** Users can view a detailed experience page with description, winery info, wines offered, location map, capacity, and cancellation policy
- **FR4:** Users can select a date/time slot and number of participants to initiate a booking
- **FR5:** Users can complete payment via Stripe with 100% prepayment required
- **FR6:** Users receive a confirmation email with booking summary, location details, and cancellation conditions
- **FR7:** Users can cancel a booking (refund policy: >24h = full refund, <24h = non-refundable)

**Encaveur-Facing:**

- **FR8:** Winemakers can register via a simplified form with manual verification by platform admin
- **FR9:** Winemakers can create experiences with: type, description, photos, price, schedule/availability, min/max capacity
- **FR10:** Winemakers can view a dashboard listing all upcoming reservations with client details
- **FR11:** Winemakers receive email notifications for each new booking, modification, or cancellation
- **FR12:** Winemakers can manage their availability calendar (block dates, set recurring schedules)

**Platform/Admin:**

- **FR13:** Platform processes payments via Stripe Connect with split payment (platform commission + winemaker payout)
- **FR14:** Platform automatically disburses winemaker payments after experience completion
- **FR15:** Platform admin can verify/approve new winemaker registrations
- **FR16:** Platform supports bilingual content (French/German) with manual translations for MVP

## 2.2 Non-Functional Requirements

- **NFR1:** Time to First Contentful Paint < 2 seconds on 3G connection
- **NFR2:** Search results returned in < 500ms
- **NFR3:** All traffic served over HTTPS
- **NFR4:** Payment processing delegated to Stripe (PCI-DSS compliance)
- **NFR5:** Personal data handling compliant with GDPR/Swiss data protection
- **NFR6:** Support modern browsers: Chrome, Safari, Firefox, Edge (last 2 versions)
- **NFR7:** Mobile-first responsive design (works on devices 320px+)
- **NFR8:** System availability target: 99.5% uptime
- **NFR9:** Booking confirmation emails sent within 60 seconds of payment completion

---
