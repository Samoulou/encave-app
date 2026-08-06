import { z } from 'zod';

/**
 * Validators for the winemaker event detail page (ENC-096).
 */

export const bookingIdSchema = z.object({
  // Bookings use Prisma `@default(cuid())` IDs (see prisma/schema.prisma).
  bookingId: z.string().cuid('bookingId must be a cuid'),
});

export type BookingIdInput = z.infer<typeof bookingIdSchema>;

export const eventDetailIdSchema = z.object({
  experienceId: z.string().cuid('experienceId must be a cuid'),
});

export type EventDetailIdInput = z.infer<typeof eventDetailIdSchema>;

export const attendeeEmailsSchema = z.object({
  experienceId: z.string().cuid('experienceId must be a cuid'),
  sessionId: z.string().min(6),
});

export type AttendeeEmailsInput = z.infer<typeof attendeeEmailsSchema>;
