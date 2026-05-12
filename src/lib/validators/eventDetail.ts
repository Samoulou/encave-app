import { z } from 'zod';

/**
 * Validators for the winemaker event detail page (ENC-096).
 */

export const bookingIdSchema = z.object({
  // Bookings use Prisma `@default(cuid())` IDs (see prisma/schema.prisma).
  bookingId: z.string().cuid('bookingId must be a cuid'),
});

export type BookingIdInput = z.infer<typeof bookingIdSchema>;

export const eventDetailSlugSchema = z.object({
  experienceSlug: z
    .string()
    .min(1, 'experienceSlug is required')
    .max(200, 'experienceSlug is too long'),
});

export type EventDetailSlugInput = z.infer<typeof eventDetailSlugSchema>;
