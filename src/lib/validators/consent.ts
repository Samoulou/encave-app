import { z } from 'zod';
import { CONSENT_VERSION } from '@/lib/constants/consent';

export const consentSchema = z.object({
  necessary: z.literal(true),
  analytics: z.boolean(),
  version: z.literal(CONSENT_VERSION),
  consentedAt: z.string().datetime(),
});

export type ConsentPayload = z.infer<typeof consentSchema>;
