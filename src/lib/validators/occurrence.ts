import { z } from 'zod';
import { timeSlotSchema } from '@/lib/validators/booking';

/**
 * Occurrence management inputs (P-05 / L-131, L-132).
 * Owner-side actions — ownership/tenant checks live in the actions.
 */

export const occurrenceIdSchema = z.object({
  occurrenceId: z.string().cuid(),
});

export const setOccurrenceCapacitySchema = z.object({
  occurrenceId: z.string().cuid(),
  /** null = back to the experience's maxCapacity. DB CHECK enforces >= 1. */
  capacityOverride: z.number().int().min(1).max(50).nullable(),
});

const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const addPunctualOccurrencesSchema = z.object({
  experienceId: z.string().cuid(),
  picks: z
    .array(
      z.object({
        date: dateKeySchema,
        startTime: timeSlotSchema,
      })
    )
    .min(1)
    .max(60),
});

export const regenerateOccurrencesSchema = z.object({
  experienceId: z.string().cuid(),
});

export type AddPunctualOccurrencesInput = z.infer<
  typeof addPunctualOccurrencesSchema
>;
