import { BookingStatus, type Prisma } from '@prisma/client';
import { zonedWallClockToUTC } from '@/lib/datetime/zurich';

/**
 * Single source of truth for "which bookings hold a seat" (P-04 / L-050
 * logical hold release):
 *  - CONFIRMED always;
 *  - PENDING_PAYMENT only while its hold/payment window is alive — an
 *    expired PENDING_PAYMENT row frees its seats immediately (the cron and
 *    the Stripe webhook are physical cleanup only);
 *  - COMPLETED and NO_SHOW always: a checked-in guest is physically in the
 *    seat and a no-show's seat was sold. Leaving them out re-opened the
 *    seats of every scanned ticket — a full slot became bookable again as
 *    guests arrived (oversell), and stays bookable for the rest of the day.
 *    It also makes the operational reverts (COMPLETED/NO_SHOW → CONFIRMED,
 *    ADR-0001) capacity-neutral.
 * Cancelled bookings never count.
 *
 * Used by every capacity aggregate (availability, slot list, hold
 * creation, checkout create, date search) and by the delete-experience
 * guard. The COUNTING key stays (experienceId, date, timeSlot) — ADR-0002
 * D1 is about that key, which this predicate does not touch. When
 * capacity moves again, this is the one place to change.
 */
export function activeCapacityBookingWhere(
  now: Date = new Date()
): Prisma.BookingWhereInput {
  return {
    OR: [
      {
        status: {
          in: [
            BookingStatus.CONFIRMED,
            BookingStatus.COMPLETED,
            BookingStatus.NO_SHOW,
          ],
        },
      },
      { status: BookingStatus.PENDING_PAYMENT, expiresAt: { gt: now } },
    ],
  };
}

/**
 * JS twin of {@link activeCapacityBookingWhere} for rows already in
 * memory — keep the two in lockstep. Used where a fetched set mixes
 * capacity-blocking and non-blocking bookings (owner calendar).
 */
export function isActiveCapacityBooking(
  booking: { status: BookingStatus; expiresAt: Date | null },
  now: Date = new Date()
): boolean {
  return (
    booking.status === BookingStatus.CONFIRMED ||
    booking.status === BookingStatus.COMPLETED ||
    booking.status === BookingStatus.NO_SHOW ||
    (booking.status === BookingStatus.PENDING_PAYMENT &&
      booking.expiresAt !== null &&
      booking.expiresAt > now)
  );
}

/**
 * Effective seat count of a slot (P-05 / ADR-0002): the occurrence's
 * override when set, the experience default otherwise. The DB CHECK
 * guarantees override >= 1.
 */
export function resolveOccurrenceCapacity(
  capacityOverride: number | null,
  maxCapacity: number
): number {
  return capacityOverride ?? maxCapacity;
}

/**
 * A slot can be sold only while its START is strictly in the future. The
 * start is the calendar `date` (date-only, UTC midnight) at the Zurich
 * wall-clock `timeSlot` — the same conversion as every session instant.
 * The date-only guard of the booking path let TODAY's sessions be held and
 * paid for hours after they began (and self-cancel then refuses a "past
 * booking"). An unparsable date is never bookable.
 */
export function isSlotStartInFuture(
  date: Date,
  timeSlot: string,
  now: Date = new Date()
): boolean {
  if (Number.isNaN(date.getTime())) return false;
  return zonedWallClockToUTC(date, timeSlot).getTime() > now.getTime();
}
