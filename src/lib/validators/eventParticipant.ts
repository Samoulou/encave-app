import { z } from 'zod';

/**
 * Validators for collective-event participant management (P-11 / L-100).
 * A participant is another VERIFIED winery shown on the organizer's
 * collective-event fiche (logo + descriptif). Owner-gated actions live in
 * `src/server/actions/eventParticipant.ts`.
 */

// Experience + winery use Prisma `@default(cuid())` IDs.
export const addEventParticipantSchema = z.object({
  experienceId: z.string().cuid('experienceId must be a cuid'),
  wineryId: z.string().cuid('wineryId must be a cuid'),
  description: z.string().trim().max(500, 'Description too long').optional(),
  logo: z.string().url('Logo must be a valid URL').optional(),
});

export type AddEventParticipantInput = z.infer<
  typeof addEventParticipantSchema
>;

export const removeEventParticipantSchema = z.object({
  participantId: z.string().cuid('participantId must be a cuid'),
});

export type RemoveEventParticipantInput = z.infer<
  typeof removeEventParticipantSchema
>;

export const reorderEventParticipantsSchema = z.object({
  experienceId: z.string().cuid('experienceId must be a cuid'),
  // Full ordered list of the experience's participants: index in the array
  // is authoritative — the action rewrites `order` from it in a transaction.
  items: z
    .array(
      z.object({
        participantId: z.string().cuid('participantId must be a cuid'),
        order: z.number().int().min(0),
      })
    )
    .min(1)
    .max(50),
});

export type ReorderEventParticipantsInput = z.infer<
  typeof reorderEventParticipantsSchema
>;
