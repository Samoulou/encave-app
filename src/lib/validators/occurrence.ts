import { z } from 'zod';
import { timeSlotSchema } from '@/lib/validators/booking';
import { isDateKey } from '@/lib/utils/date-key';
import {
  OCCURRENCE_CAPACITY_MAX,
  OCCURRENCE_CAPACITY_MIN,
} from '@/lib/constants/occurrences';

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
  capacityOverride: z
    .number()
    .int()
    .min(OCCURRENCE_CAPACITY_MIN)
    .max(OCCURRENCE_CAPACITY_MAX)
    .nullable(),
});

// isDateKey rejects impossible dates ("2026-02-31") that a bare regex
// lets through — those would construct an Invalid Date and surface as
// INTERNAL_ERROR instead of VALIDATION_ERROR.
const dateKeySchema = z
  .string()
  .refine(isDateKey, 'Expected a valid YYYY-MM-DD date');

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

export type AddPunctualOccurrencesInput = z.infer<
  typeof addPunctualOccurrencesSchema
>;
