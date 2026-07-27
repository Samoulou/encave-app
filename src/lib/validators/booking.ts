import { z } from 'zod';

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
 * Slot hold created at « Continuer » (P-04 / L-050). `previousHoldId` +
 * `previousHoldToken` let the widget hand back its still-live prior hold
 * (browser Back, changed party size) so its seats are released before the
 * capacity check — otherwise users self-block on their own hold.
 */
export const createHoldSchema = z.object({
  experienceId: z.string(),
  date: z.string(),
  timeSlot: timeSlotSchema,
  guestCount: z.number().int().positive(),
  previousHoldId: z.string().cuid().optional(),
  previousHoldToken: z.string().min(16).optional(),
});

/**
 * Parse a validated time slot string into hours and minutes
 * Only call this after validation with timeSlotSchema
 */
export function parseTimeSlot(timeSlot: string): {
  hours: number;
  minutes: number;
} {
  const [hoursStr, minutesStr] = timeSlot.split(':');
  if (hoursStr === undefined || minutesStr === undefined) {
    throw new Error(`Invalid time slot format: ${timeSlot}`);
  }
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

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
