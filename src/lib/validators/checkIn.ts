import { z } from 'zod';

export const checkInBookingSchema = z.object({
  token: z.string().min(32).optional(),
  bookingId: z.string().cuid().optional(),
  expectedSessionId: z.string().optional(),
  source: z.enum(['scan', 'manual']).default('scan'),
});
