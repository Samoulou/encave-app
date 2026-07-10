import { z } from 'zod';

export const checkInBookingSchema = z.object({
  token: z.string().min(32).optional(),
  bookingId: z.string().cuid().optional(),
  expectedSessionId: z.string().optional(),
  /**
   * When the scan happened offline and is replayed later, the moment of
   * the PHYSICAL scan (ISO). The day-mode guard validates against this
   * instant instead of the sync time, within a bounded window.
   */
  scannedAt: z.iso.datetime().optional(),
  source: z.enum(['scan', 'manual']).default('scan'),
});
