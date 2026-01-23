# US-UI-09: Winemaker Dashboard - Bookings UI Adaptation

## Story

**As a** winemaker managing incoming bookings,
**I want** a comprehensive bookings dashboard with clear status indicators and actions,
**So that** I can efficiently manage reservations and provide great customer service.

---

## References

| Resource | Location |
|----------|----------|
| **Mockup PNG** | `docs/mockups/winemaker_dashboard_-_bookings/screen.png` |
| **Mockup Code** | `docs/mockups/winemaker_dashboard_-_bookings/code.html` |
| **UI Spec** | `docs/ui-adaptation-spec.md` (Section: Winemaker Bookings) |
| **Current Page** | `src/app/[locale]/(protected)/dashboard/bookings/page.tsx` |

---

## Acceptance Criteria

### AC1: Page Header
- [ ] Title: "Bookings" (`text-3xl font-black`)
- [ ] Action buttons (right side):
  - "Export CSV" (secondary style, download icon)
  - "Add Booking" (primary style, + icon)

### AC2: KPI Cards Row
- [ ] Three cards in a row (stack on mobile)
- [ ] Card 1 - Total Bookings:
  - Label: "TOTAL BOOKINGS" (uppercase, small, gray)
  - Value: Large number (e.g., "124")
  - Trend badge: `+12%` with up arrow (green)
  - Icon: booking/calendar icon (top-right)
- [ ] Card 2 - Upcoming (7 Days):
  - Label: "UPCOMING (7 DAYS)"
  - Value: Number (e.g., "8")
  - Icon: clock icon
- [ ] Card 3 - Occupancy Rate:
  - Label: "OCCUPANCY RATE"
  - Value: Percentage (e.g., "78%")
  - Progress bar below (primary color fill)
  - Subtext: "Avg. this month"

### AC3: Search & Filter Bar
- [ ] Search input with icon: "Search by client name, email..."
- [ ] Filter button with icon
- [ ] View toggle (right side):
  - "List View" (default, active)
  - "Calendar" view option
- [ ] Toggle styling: `bg-[#f8f6f6]` container, active has white bg + shadow

### AC4: Bookings Table
- [ ] Table columns:
  1. **Booking Info** - Date + Time
  2. **Client** - Avatar + Name + Email
  3. **Experience** - Experience name
  4. **Guests** - Icon + count
  5. **Status** - Badge
  6. **Actions** - Context menu or inline buttons

### AC5: Table Row Design
- [ ] Row hover: `hover:bg-[#fbf9f9]`
- [ ] Booking Info cell:
  - Date bold (e.g., "Oct 24, 2023")
  - Time below in gray (e.g., "14:00 - 16:00")
- [ ] Client cell:
  - Avatar (rounded-full, 36px)
  - Name (font-semibold)
  - Email below (small, gray)
- [ ] If no avatar: Show initials in colored circle

### AC6: Status Badges
- [ ] **Confirmed**:
  ```tsx
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                   text-xs font-bold bg-[#ecfdf5] text-[#047857] border border-[#d1fae5]">
    <span className="size-1.5 rounded-full bg-[#047857]" />
    Confirmed
  </span>
  ```
- [ ] **Pending**:
  - `bg-[#fffbeb] text-[#b45309] border-[#fef3c7]`
- [ ] **Cancelled**:
  - `bg-[#fef2f2] text-[#991b1b] border-[#fee2e2]`

### AC7: Row Actions
- [ ] For **Confirmed/Cancelled**: Three-dot menu (more_vert icon)
  - Menu options: View Details, Contact Client, Cancel Booking
- [ ] For **Pending**: Inline action buttons
  - Approve button (checkmark, green)
  - Reject button (X, red)
  - Both compact: `p-1.5 rounded-lg`

### AC8: Pagination
- [ ] Footer row with:
  - "Showing X to Y of Z results" (left)
  - Previous/Next buttons (right)
- [ ] Styling: `border-t border-[#e5d2d7]`

### AC9: Empty State
- [ ] If no bookings: Show empty state illustration
- [ ] Message: "No bookings yet"
- [ ] Subtext: "When customers book your experiences, they'll appear here."

### AC10: Calendar View (Toggle)
- [ ] When "Calendar" selected:
  - Show monthly calendar grid
  - Bookings as colored dots/events on dates
  - Click date to see day's bookings
- [ ] (Note: Can be simplified for initial implementation)

---

## Technical Notes

### Components to Create/Update
- `src/app/[locale]/(protected)/dashboard/bookings/page.tsx`
- `src/components/features/booking/dashboard/BookingsKPICards.tsx`
- `src/components/features/booking/dashboard/BookingsTable.tsx`
- `src/components/features/booking/dashboard/BookingRow.tsx`
- `src/components/features/booking/dashboard/StatusBadge.tsx`
- `src/components/features/booking/dashboard/BookingActions.tsx`
- `src/components/features/booking/dashboard/CalendarView.tsx` (optional)

### KPI Data Fetching
```typescript
const { data: kpis } = useBookingKPIs(wineryId);
// Returns: { total, upcoming, occupancyRate, trend }
```

### Table Data Structure
```typescript
interface BookingRow {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  client: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  experience: {
    name: string;
  };
  guestCount: number;
  status: 'confirmed' | 'pending' | 'cancelled';
}
```

### Pending Action Handlers
```typescript
const handleApprove = async (bookingId: string) => {
  await updateBookingStatus(bookingId, 'confirmed');
  toast.success('Booking confirmed');
  // Send confirmation email to client
};

const handleReject = async (bookingId: string) => {
  // Show confirmation dialog with reason input
  await updateBookingStatus(bookingId, 'cancelled', reason);
  toast.success('Booking rejected');
  // Send rejection email to client
};
```

### Trend Calculation
```typescript
const calculateTrend = (current: number, previous: number) => {
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(change).toFixed(0),
    direction: change >= 0 ? 'up' : 'down',
  };
};
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Table over cards | Better for scanning multiple bookings quickly |
| Inline approve/reject for pending | Faster action, reduces clicks |
| Avatar with fallback initials | Personal touch, works without image |
| Separate calendar view | Different use case (availability planning) |

---

## Out of Scope
- Bulk status updates
- Email/SMS reminders from this screen
- Revenue per booking (shown in Earnings)

---

## Definition of Done
- [ ] KPI cards display accurate data
- [ ] Table renders all booking data correctly
- [ ] Status badges match mockup exactly
- [ ] Approve/Reject actions functional for pending
- [ ] Context menu working for other statuses
- [ ] Search filters table results
- [ ] Pagination functional
- [ ] Export CSV downloads valid file
- [ ] View toggle switches between list/calendar
- [ ] Mobile responsive (table scrolls horizontally or stacks)
- [ ] Visual match with mockup 90%+
- [ ] Code reviewed and merged
