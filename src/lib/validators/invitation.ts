import { z } from 'zod';

/**
 * Founder-invitation validators (P-14 / L-154). An admin issues a one-time
 * link; accepting it provisions a VERIFIED FOUNDER winery, skipping the queue.
 */

export const createFounderInvitationSchema = z.object({
  email: z.string().email(),
  wineryName: z.string().trim().min(1).max(120),
});

export type CreateFounderInvitationInput = z.infer<
  typeof createFounderInvitationSchema
>;

export const provisionFounderWinerySchema = z.object({
  // Plaintext invitation token (looked up by its sha256 hash).
  token: z.string().min(32),
  wineryName: z.string().trim().min(1).max(120),
});

export type ProvisionFounderWineryInput = z.infer<
  typeof provisionFounderWinerySchema
>;
