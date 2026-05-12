import { z } from 'zod';

/**
 * Validators for the winemaker event detail page (ENC-096).
 */

export const bookingIdSchema = z.object({
  bookingId: z
    .string()
    .min(1, 'bookingId is required')
    .max(64, 'bookingId is too long'),
});

export type BookingIdInput = z.infer<typeof bookingIdSchema>;

export const eventDetailSlugSchema = z.object({
  experienceSlug: z
    .string()
    .min(1, 'experienceSlug is required')
    .max(200, 'experienceSlug is too long'),
});

export type EventDetailSlugInput = z.infer<typeof eventDetailSlugSchema>;
