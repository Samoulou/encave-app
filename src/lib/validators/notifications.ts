import { z } from 'zod';

export const notificationPreferencesSchema = z.object({
  dailyDigest: z.boolean(),
  weeklySummary: z.boolean(),
  instantBookingAlerts: z.boolean(),
});

export type NotificationPreferencesInput = z.infer<
  typeof notificationPreferencesSchema
>;
