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
- [x] Title: "Bookings" (`text-3xl font-black`)
- [x] Action buttons (right side):
  - "Export CSV" (secondary style, download icon)
  - "Add Booking" (primary style, + icon)

### AC2: KPI Cards Row
- [x] Three cards in a row (stack on mobile)
- [x] Card 1 - Total Bookings:
  - Label: "TOTAL BOOKINGS" (uppercase, small, gray)
  - Value: Large number (e.g., "124")
  - Trend badge: `+12%` with up arrow (green)
  - Icon: booking/calendar icon (top-right)
- [x] Card 2 - Upcoming (7 Days):
  - Label: "UPCOMING (7 DAYS)"
  - Value: Number (e.g., "8")
  - Icon: clock icon
- [x] Card 3 - Occupancy Rate:
  - Label: "OCCUPANCY RATE"
  - Value: Percentage (e.g., "78%")
  - Progress bar below (primary color fill)
  - Subtext: "Avg. this month"

### AC3: Search & Filter Bar
- [x] Search input with icon: "Search by client name, email..."
- [x] Filter button with icon
- [x] View toggle (right side):
  - "List View" (default, active)
  - "Calendar" view option
- [x] Toggle styling: `bg-[#f8f6f6]` container, active has white bg + shadow

### AC4: Bookings Table
- [x] Table columns:
  1. **Booking Info** - Date + Time
  2. **Client** - Avatar + Name + Email
  3. **Experience** - Experience name
  4. **Guests** - Icon + count
  5. **Status** - Badge
  6. **Actions** - Context menu or inline buttons

### AC5: Table Row Design
- [x] Row hover: `hover:bg-[#fbf9f9]`
- [x] Booking Info cell:
  - Date bold (e.g., "Oct 24, 2023")
  - Time below in gray (e.g., "14:00 - 16:00")
- [x] Client cell:
  - Avatar (rounded-full, 36px)
  - Name (font-semibold)
  - Email below (small, gray)
- [x] If no avatar: Show initials in colored circle

### AC6: Status Badges
- [x] **Confirmed**:
  ```tsx
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                   text-xs font-bold bg-[#ecfdf5] text-[#047857] border border-[#d1fae5]">
    <span className="size-1.5 rounded-full bg-[#047857]" />
    Confirmed
  </span>
  ```
- [x] **Pending**:
  - `bg-[#fffbeb] text-[#b45309] border-[#fef3c7]`
- [x] **Cancelled**:
  - `bg-[#fef2f2] text-[#991b1b] border-[#fee2e2]`

### AC7: Row Actions
- [x] For **Confirmed/Cancelled**: Three-dot menu (more_vert icon)
  - Menu options: View Details, Contact Client, Cancel Booking
- [x] For **Pending**: Inline action buttons
  - Approve button (checkmark, green)
  - Reject button (X, red)
  - Both compact: `p-1.5 rounded-lg`

### AC8: Pagination
- [x] Footer row with:
  - "Showing X to Y of Z results" (left)
  - Previous/Next buttons (right)
- [x] Styling: `border-t border-[#e5d2d7]`

### AC9: Empty State
- [x] If no bookings: Show empty state illustration
- [x] Message: "No bookings yet"
- [x] Subtext: "When customers book your experiences, they'll appear here."

### AC10: Calendar View (Toggle)
- [x] When "Calendar" selected:
  - Show monthly calendar grid
  - Bookings as colored dots/events on dates
  - Click date to see day's bookings
- [x] (Note: Can be simplified for initial implementation)

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
- [x] KPI cards display accurate data
- [x] Table renders all booking data correctly
- [x] Status badges match mockup exactly
- [x] Approve/Reject actions functional for pending
- [x] Context menu working for other statuses
- [x] Search filters table results
- [x] Pagination functional
- [x] Export CSV downloads valid file
- [x] View toggle switches between list/calendar
- [x] Mobile responsive (table scrolls horizontally or stacks)
- [x] Visual match with mockup 90%+
- [ ] Code reviewed and merged

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List
- `src/app/[locale]/(protected)/dashboard/bookings/page.tsx` - Updated page layout and skeletons
- `src/app/[locale]/(protected)/dashboard/bookings/BookingsPageHeader.tsx` - New: Header with title and action buttons
- `src/app/[locale]/(protected)/dashboard/bookings/BookingsFiltersSection.tsx` - Updated toolbar layout
- `src/app/[locale]/(protected)/dashboard/bookings/BookingsTableSection.tsx` - Simplified table section
- `src/components/features/booking/dashboard/BookingSummaryCards.tsx` - Updated: 3 KPI cards matching mockup
- `src/components/features/booking/dashboard/BookingsTable.tsx` - Redesigned table with avatar, inline actions, pagination
- `src/components/features/booking/dashboard/BookingStatusBadge.tsx` - Updated with dot indicator per mockup
- `src/components/features/booking/dashboard/BookingSearch.tsx` - Updated styling to match mockup
- `src/components/features/booking/dashboard/BookingFilters.tsx` - Consolidated filter dropdown
- `src/components/features/booking/dashboard/ExportCSVButton.tsx` - Updated button styling
- `src/components/features/booking/dashboard/BookingsEmptyState.tsx` - Updated empty state design
- `src/components/features/booking/calendar/ViewToggle.tsx` - Updated with List/Calendar toggle text
- `src/server/actions/booking-dashboard.ts` - Added approveBooking/rejectBooking actions

### Change Log
- Created BookingsPageHeader component with title and Export CSV/Add Booking buttons
- Redesigned KPI summary cards to 3-card layout: Total Bookings (with trend), Upcoming (7 Days), Occupancy Rate (with progress bar)
- Updated filter toolbar with search input, Filter dropdown, and List View/Calendar toggle
- Redesigned BookingsTable with proper columns: Booking Info, Client (avatar+initials), Experience, Guests, Status, Actions
- Updated BookingStatusBadge with dot indicator and mockup-specific colors
- Added inline Approve/Reject buttons for pending bookings
- Added three-dot context menu for confirmed/cancelled bookings
- Implemented pagination footer with "Showing X to Y of Z results" text
- Updated BookingsEmptyState design
- Added approveBooking and rejectBooking server actions

### Completion Notes
All acceptance criteria implemented. Build and lint pass successfully. The calendar view toggle uses the existing CalendarView component.

### DoD Checklist Summary

1. **Requirements Met:** [x] All AC1-AC10 acceptance criteria implemented
2. **Coding Standards:** [x] Following project coding standards and structure
3. **Testing:** [!] No new component tests added - UI adaptation story uses existing query/action tests
4. **Functionality:** [x] Build verified, edge cases handled (approve/reject with loading states)
5. **Story Administration:** [x] All tasks complete, Dev Agent Record populated
6. **Dependencies/Build:** [x] No new dependencies, build and lint pass
7. **Documentation:** [N/A] No new public APIs requiring documentation

### Status
Ready for Review
