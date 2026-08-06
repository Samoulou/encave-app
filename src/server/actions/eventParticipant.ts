'use server';

import { Prisma } from '@prisma/client';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { withSerializableRetry } from '@/server/services/serializable-retry.service';
import {
  addEventParticipantSchema,
  removeEventParticipantSchema,
  reorderEventParticipantsSchema,
  type AddEventParticipantInput,
  type RemoveEventParticipantInput,
  type ReorderEventParticipantsInput,
} from '@/lib/validators/eventParticipant';
import { eligibleParticipantWineryWhere } from '@/lib/business-rules/collective-events';
import { logError } from '@/lib/logger';
import type { ActionResult } from '@/types/actions';
import { invalidateExperienceCaches } from './experience-helpers';

/**
 * Collective-event participant management (P-11 / L-100).
 *
 * The organizing winery adds/removes/reorders other VERIFIED wineries shown
 * on its collective-event fiche. Every action is owner-gated (the caller must
 * own the target experience via a VERIFIED winery) and flag-gated
 * (`COLLECTIVE_EVENTS` OFF ⇒ inert). Participant descriptions/logos are the
 * building blocks of the public grid + mini-program (L-101).
 */

interface OwnedExperienceContext {
  experienceSlug: string;
  /** The organizing winery — the single paid organizer (schema invariant). */
  wineryId: string;
  winerySlug: string;
}

const UNAUTHORIZED = {
  success: false,
  error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
} as const satisfies ActionResult<never>;

const FLAG_OFF = {
  success: false,
  error: { code: 'FORBIDDEN', message: 'Collective events are not enabled' },
} as const satisfies ActionResult<never>;

/**
 * Resolve + owner-gate the target experience. Mirrors the VERIFIED-winery
 * gate of experience-crud.ts. Returns the caller's winery + experience slugs
 * (needed for cache invalidation) or an ActionResult error.
 */
async function resolveOwnedExperience(
  userId: string,
  experienceId: string
): Promise<ActionResult<OwnedExperienceContext>> {
  const winery = await db.winery.findUnique({
    where: { userId },
    select: { id: true, slug: true, status: true },
  });

  if (!winery || winery.status !== 'VERIFIED') {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied' },
    };
  }

  const experience = await db.experience.findFirst({
    where: { id: experienceId, wineryId: winery.id },
    select: { slug: true, wineryId: true },
  });

  if (!experience) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Experience not found' },
    };
  }

  return {
    success: true,
    data: {
      experienceSlug: experience.slug,
      wineryId: experience.wineryId,
      winerySlug: winery.slug,
    },
  };
}

/**
 * Add a participating winery to a collective event.
 */
export async function addEventParticipant(
  input: AddEventParticipantInput
): Promise<ActionResult<{ participantId: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    if (!(await isFlagEnabled('COLLECTIVE_EVENTS'))) return FLAG_OFF;

    const parsed = addEventParticipantSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
        },
      };
    }

    const owned = await resolveOwnedExperience(
      session.user.id,
      parsed.data.experienceId
    );
    if (!owned.success) return owned;

    // The organizer is never listed as its own participant.
    if (parsed.data.wineryId === owned.data.wineryId) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The organizing winery cannot be a participant',
        },
      };
    }

    // Target must be an eligible (VERIFIED, non-suspended) winery — same rule
    // as the public grid + picker (single source in collective-events.ts).
    const target = await db.winery.findFirst({
      where: { id: parsed.data.wineryId, ...eligibleParticipantWineryWhere },
      select: { id: true },
    });
    if (!target) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'This winery cannot be added as a participant',
        },
      };
    }

    // Idempotent guard (the DB unique [experienceId, wineryId] is the backstop).
    const existing = await db.eventParticipant.findUnique({
      where: {
        experienceId_wineryId: {
          experienceId: parsed.data.experienceId,
          wineryId: parsed.data.wineryId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'This winery is already a participant',
        },
      };
    }

    // Append at the end. The max-read and the insert run in one Serializable
    // transaction so two concurrent adds can't both claim the same order value
    // (the loser aborts with P2034 and retries, re-reading the new max).
    const participant = await withSerializableRetry(
      () =>
        db.$transaction(
          async (tx) => {
            const maxOrder = await tx.eventParticipant.aggregate({
              where: { experienceId: parsed.data.experienceId },
              _max: { order: true },
            });
            return tx.eventParticipant.create({
              data: {
                experienceId: parsed.data.experienceId,
                wineryId: parsed.data.wineryId,
                description: parsed.data.description,
                logo: parsed.data.logo,
                order: (maxOrder._max.order ?? -1) + 1,
              },
              select: { id: true },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        ),
      'addEventParticipant'
    );

    invalidateExperienceCaches(
      owned.data.winerySlug,
      owned.data.experienceSlug
    );

    return { success: true, data: { participantId: participant.id } };
  } catch (error) {
    logError('addEventParticipant error', error, {
      action: 'addEventParticipant',
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    };
  }
}

/**
 * Remove a participating winery from a collective event.
 */
export async function removeEventParticipant(
  input: RemoveEventParticipantInput
): Promise<ActionResult<{ removed: true }>> {
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    if (!(await isFlagEnabled('COLLECTIVE_EVENTS'))) return FLAG_OFF;

    const parsed = removeEventParticipantSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      };
    }

    const participant = await db.eventParticipant.findUnique({
      where: { id: parsed.data.participantId },
      select: {
        id: true,
        experience: {
          select: {
            slug: true,
            winery: { select: { userId: true, slug: true } },
          },
        },
      },
    });

    if (!participant) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Participant not found' },
      };
    }

    if (participant.experience.winery.userId !== session.user.id) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not your event' },
      };
    }

    await db.eventParticipant.delete({ where: { id: participant.id } });

    invalidateExperienceCaches(
      participant.experience.winery.slug,
      participant.experience.slug
    );

    return { success: true, data: { removed: true } };
  } catch (error) {
    logError('removeEventParticipant error', error, {
      action: 'removeEventParticipant',
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    };
  }
}

/**
 * Reorder the participants of a collective event. `items` index order is
 * authoritative; every id must belong to the owned experience.
 */
export async function reorderEventParticipants(
  input: ReorderEventParticipantsInput
): Promise<ActionResult<{ reordered: true }>> {
  try {
    const session = await auth();
    if (!session?.user) return UNAUTHORIZED;
    if (!(await isFlagEnabled('COLLECTIVE_EVENTS'))) return FLAG_OFF;

    const parsed = reorderEventParticipantsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      };
    }

    const owned = await resolveOwnedExperience(
      session.user.id,
      parsed.data.experienceId
    );
    if (!owned.success) return owned;

    const current = await db.eventParticipant.findMany({
      where: { experienceId: parsed.data.experienceId },
      select: { id: true },
    });
    const currentIds = new Set(current.map((p) => p.id));
    const submittedIds = parsed.data.items.map((item) => item.participantId);
    const uniqueSubmitted = new Set(submittedIds);
    // The items list must be the COMPLETE participant set (index order is
    // authoritative). A partial payload would leave omitted rows with stale
    // order → duplicate/gappy order values, so reject anything but an exact,
    // duplicate-free cover of the current participants.
    const isCompleteCover =
      uniqueSubmitted.size === submittedIds.length &&
      uniqueSubmitted.size === currentIds.size &&
      submittedIds.every((id) => currentIds.has(id));
    if (!isCompleteCover) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The reorder must list every participant exactly once',
        },
      };
    }

    await db.$transaction(
      parsed.data.items.map((item) =>
        db.eventParticipant.update({
          where: { id: item.participantId },
          data: { order: item.order },
        })
      )
    );

    invalidateExperienceCaches(
      owned.data.winerySlug,
      owned.data.experienceSlug
    );

    return { success: true, data: { reordered: true } };
  } catch (error) {
    logError('reorderEventParticipants error', error, {
      action: 'reorderEventParticipants',
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    };
  }
}
