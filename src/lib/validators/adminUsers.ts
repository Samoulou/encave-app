import { z } from 'zod';

/**
 * Role changes are restricted to CLIENT ↔ WINEMAKER (P-15 / L-162). ADMIN is
 * deliberately NOT representable here — the admin role is never assignable via
 * the UI (privilege-escalation guard); granting/removing it stays a manual DB
 * operation.
 */
export const ChangeUserRoleSchema = z.object({
  targetId: z.string().cuid(),
  role: z.enum(['CLIENT', 'WINEMAKER']),
});
export type ChangeUserRoleInput = z.infer<typeof ChangeUserRoleSchema>;

export const AnonymizeUserSchema = z.object({
  targetId: z.string().cuid(),
  reason: z.string().trim().min(10).max(500),
  /** Whether to email the "account deleted" notice to the user (per case). */
  notifyUser: z.boolean(),
});
export type AnonymizeUserInput = z.infer<typeof AnonymizeUserSchema>;
