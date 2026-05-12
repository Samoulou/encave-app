import type { BookingStatus } from '@prisma/client';

/**
 * ENC-067 — Discriminated union of the 5 outcomes of the synchronous payment
 * reconciliation flow (`reconcileBookingPayment`).
 *
 * The shape lets the page confirmation Server Component render the right UI
 * branch without re-querying Stripe.
 */
export type PaymentReconciliationState =
  | { kind: 'CONFIRMED'; bookingId: string }
  | { kind: 'ALREADY_CONFIRMED'; bookingId: string }
  | { kind: 'ALREADY_CANCELLED'; bookingId: string; status: BookingStatus }
  | { kind: 'PAYMENT_FAILED_INSTANT' }
  | { kind: 'SESSION_EXPIRED' };
