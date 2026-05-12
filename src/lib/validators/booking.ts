import { z } from 'zod';

/**
 * ENC-067 — Schema for the synchronous payment reconciliation action.
 *
 * Validates inputs to `reconcileBookingPayment`. The `sessionId` shape
 * matches Stripe's `cs_(test|live)_<token>` format. `accessToken` is optional
 * (used to authorize a guest who arrives later from an email link).
 */
export const reconcileBookingPaymentSchema = z.object({
  bookingId: z.string().min(1),
  sessionId: z
    .string()
    .regex(/^cs_(test|live)_[A-Za-z0-9]+$/, 'Invalid Stripe session id'),
  accessToken: z.string().min(16).optional(),
});

export type ReconcileBookingPaymentInput = z.infer<
  typeof reconcileBookingPaymentSchema
>;

/**
 * BACK-003 FIX: Validate HH:mm time format
 * Prevents NaN from parseInt when parsing invalid time strings
 */
export const timeSlotSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):([0-5]\d)$/,
    'Invalid time format. Expected HH:mm (e.g., 14:30)'
  );

/**
 * Parse a validated time slot string into hours and minutes
 * Only call this after validation with timeSlotSchema
 */
export function parseTimeSlot(timeSlot: string): {
  hours: number;
  minutes: number;
} {
  const [hoursStr, minutesStr] = timeSlot.split(':');
  const hours = parseInt(hoursStr!, 10);
  const minutes = parseInt(minutesStr!, 10);

  // Double-check for safety (should never happen if timeSlotSchema was used)
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time slot format: ${timeSlot}`);
  }

  return { hours, minutes };
}

/**
 * Safely parse a time slot, returning null if invalid
 * Use this when you can't guarantee the input was validated
 */
export function safeParseTimeSlot(
  timeSlot: string | null | undefined
): { hours: number; minutes: number } | null {
  if (!timeSlot) return null;

  const result = timeSlotSchema.safeParse(timeSlot);
  if (!result.success) return null;

  return parseTimeSlot(result.data);
}
