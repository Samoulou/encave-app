import { BookingStatus, type Prisma } from '@prisma/client';

/**
 * Collective-event business rules (P-11), shared so the public grid, the
 * picker, the add action, and the participant read gate never drift.
 */

/**
 * A winery is eligible to take part in a collective event when it is VERIFIED
 * and its owner is not suspended. Used both as the visibility filter on
 * participating wineries AND — applied to the CALLER's winery — as the tenant
 * gate on the participant read view (a suspended/unverified winery sees
 * nothing, mirroring WineryAccessGuard on every other dashboard surface).
 */
export const eligibleParticipantWineryWhere = {
  status: 'VERIFIED',
  user: { suspendedAt: null },
} satisfies Prisma.WineryWhereInput;

/**
 * Seats that count as "sold" for a collective event: real attendees only
 * (live holds + cancellations excluded). A booking holds a single status, so
 * summing guestCount over this set never double-counts. "Scanned" is the
 * COMPLETED subset. Shared by the participant read view and admin oversight.
 */
export const COLLECTIVE_SOLD_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
] as const;
