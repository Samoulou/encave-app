/**
 * What a booking EARNED its winery through the platform — the single rule
 * behind the earnings summary, the revenue chart, the transactions list,
 * the yearly export and the monthly statement PDF (pre-launch audit M1).
 *
 * Rule: a money figure only ever counts a booking with a REAL online money
 * movement — a card charge (`stripePaymentIntentId`) or a gift redemption.
 *
 *  - ON_SITE / free offers (price settled at the winery) are VOLUME: they
 *    are listed and counted as bookings, never as gross, commission or net.
 *    (`platformFee` / `wineryPayout` are stored on every row, including
 *    those — reading them blindly invented a commission and a payout.)
 *  - A cancelled booking where the winery KEPT money (late cancellation, or
 *    a partial refund per the cancellation policy) still counts, net of the
 *    refund. A fully refunded one earned nothing and is not listed.
 *  - Refunds are read from `refundAmount` alone: a partial admin refund
 *    (which leaves `refundIssued` false) is deducted like any other.
 *  - NO_SHOW is money kept, exactly like COMPLETED — everywhere.
 *
 * Pure module (string unions mirror the Prisma enums structurally) so the
 * rule is unit-testable without a database.
 */

export type EarningsBookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED_BY_CLIENT'
  | 'CANCELLED_BY_WINERY'
  | 'NO_SHOW';

/** Statuses of a booking that took (or will take) place. */
export const EARNINGS_ACTIVE_STATUSES = [
  'CONFIRMED',
  'COMPLETED',
  'NO_SHOW',
] as const;

export interface EarningsBookingFacts {
  status: EarningsBookingStatus;
  /** Tickets, cents — client service fee excluded. */
  totalPrice: number;
  serviceFeeCents: number;
  /** Platform commission snapshotted on the booking. */
  platformFee: number;
  wineryPayout: number;
  /** TOTAL returned to the client (card + restored gift), cents. */
  refundAmount: number | null;
  refundIssued: boolean;
  stripePaymentIntentId: string | null;
  giftAppliedCents: number;
  /** Platform→winery transfer of a gift-funded booking, once settled. */
  giftTransferId: string | null;
}

function isActiveStatus(status: EarningsBookingStatus): boolean {
  return (
    status === 'CONFIRMED' || status === 'COMPLETED' || status === 'NO_SHOW'
  );
}

/**
 * Did real money move online for this booking?
 *
 * A card charge always counts. A gift redemption counts on a booking that
 * took place; on a CANCELLED one only when the winery transfer was settled
 * — an abandoned checkout is cancelled with `giftAppliedCents` still on
 * the row (the gift was released), and never moved a centime.
 */
export function hasOnlineMoneyMovement(booking: EarningsBookingFacts): boolean {
  if (booking.stripePaymentIntentId) return true;
  if (booking.giftAppliedCents <= 0) return false;
  return isActiveStatus(booking.status) || Boolean(booking.giftTransferId);
}

/**
 * Share of what the client paid (tickets + service fee) that went back.
 * Stripe reverses the winery transfer and the application fee in the same
 * proportion, so the winery keeps `payout × (1 − fraction)`.
 */
export function refundedFraction(
  booking: Pick<
    EarningsBookingFacts,
    'totalPrice' | 'serviceFeeCents' | 'refundAmount' | 'refundIssued'
  >
): number {
  const paid = booking.totalPrice + booking.serviceFeeCents;
  if (booking.refundAmount === null) {
    // Legacy rows flagged refunded without an amount: a full refund.
    return booking.refundIssued ? 1 : 0;
  }
  if (booking.refundAmount <= 0) return 0;
  if (paid <= 0) return 1;
  return Math.min(1, booking.refundAmount / paid);
}

export interface BookingEarnings {
  /** Appears in listings (statement lines, booking counts). */
  listed: boolean;
  /** A booking that took / will take place — the VOLUME count. */
  countsAsBooking: boolean;
  /** Real online money moved — false for ON_SITE (figures are all 0). */
  online: boolean;
  /** Tickets sold online, before refunds. */
  grossCents: number;
  /** Tickets sold online, net of refunds (chart revenue, year-to-date). */
  grossKeptCents: number;
  /** Platform commission actually kept (refunded pro rata). */
  commissionCents: number;
  /** Ticket money returned to clients. gross − commission − refunded = net. */
  refundedCents: number;
  /** What the winery keeps. */
  netCents: number;
  /** Anything was refunded on this booking. */
  refunded: boolean;
}

const NOT_LISTED: BookingEarnings = {
  listed: false,
  countsAsBooking: false,
  online: false,
  grossCents: 0,
  grossKeptCents: 0,
  commissionCents: 0,
  refundedCents: 0,
  netCents: 0,
  refunded: false,
};

/** The earnings of ONE booking under the rule above. */
export function computeBookingEarnings(
  booking: EarningsBookingFacts
): BookingEarnings {
  const active = isActiveStatus(booking.status);
  // Only a CLIENT cancellation can leave money with the winery: a winery
  // cancellation (and an admin full refund, which lands on the same
  // status) always returns everything.
  const cancelledByClient = booking.status === 'CANCELLED_BY_CLIENT';
  if (!active && !cancelledByClient) return NOT_LISTED;

  const online = hasOnlineMoneyMovement(booking);
  if (!online) {
    // ON_SITE / free: volume only. A cancelled one is nothing at all.
    return active
      ? { ...NOT_LISTED, listed: true, countsAsBooking: true }
      : NOT_LISTED;
  }

  const fraction = refundedFraction(booking);
  const kept = 1 - fraction;
  const netCents = Math.round(booking.wineryPayout * kept);
  const commissionCents = Math.round(booking.platformFee * kept);
  // A cancelled booking fully refunded earned nothing — not listed.
  if (!active && netCents <= 0) return NOT_LISTED;

  const grossCents = booking.totalPrice;
  return {
    listed: true,
    countsAsBooking: active,
    online: true,
    grossCents,
    grossKeptCents: Math.round(booking.totalPrice * kept),
    commissionCents,
    // Derived, so the statement identity is exact to the cent.
    refundedCents: grossCents - commissionCents - netCents,
    netCents,
    refunded: fraction > 0,
  };
}
