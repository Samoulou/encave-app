import { BookingStatus, type Prisma } from '@prisma/client';

/**
 * Single source of truth for "which bookings block capacity" (P-04 /
 * L-050 logical hold release): CONFIRMED always; PENDING_PAYMENT only
 * while its hold/payment window is alive. An expired PENDING_PAYMENT row
 * frees its seats immediately — the cron and the Stripe webhook are
 * physical cleanup only.
 *
 * Used by every capacity aggregate (availability, slot list, hold
 * creation, checkout create) and by the delete-experience guard. When
 * P-05 moves capacity to persisted occurrences, this is the one place
 * to change.
 */
export function activeCapacityBookingWhere(
  now: Date = new Date()
): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: BookingStatus.CONFIRMED },
      { status: BookingStatus.PENDING_PAYMENT, expiresAt: { gt: now } },
    ],
  };
}
