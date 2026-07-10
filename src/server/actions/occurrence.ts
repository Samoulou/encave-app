'use server';

import { revalidateTag } from 'next/cache';
import { ExperienceStatus, OccurrenceStatus } from '@prisma/client';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import type { ActionResult } from '@/types/actions';
import { logError, logInfo } from '@/lib/logger';
import {
  occurrenceIdSchema,
  setOccurrenceCapacitySchema,
  addPunctualOccurrencesSchema,
} from '@/lib/validators/occurrence';
import { createPunctualOccurrences } from '@/server/services/occurrence.service';
import { invalidateExperienceCaches } from './experience-helpers';

/**
 * Owner-side occurrence management (P-05 / L-131, L-132).
 * Every action: auth → safeParse → ownership (experience.winery.userId)
 * → mutation → cache invalidation. Closing/capacity become authoritative
 * on the booking path via the in-transaction re-read (ADR-0002 §3).
 */

interface OwnedOccurrence {
  id: string;
  status: OccurrenceStatus;
  experienceId: string;
  experience: {
    slug: string;
    status: ExperienceStatus;
    maxCapacity: number;
    winery: { slug: string };
  };
}

async function loadOwnedOccurrence(
  occurrenceId: string,
  userId: string
): Promise<OwnedOccurrence | null> {
  return db.experienceOccurrence.findFirst({
    where: { id: occurrenceId, experience: { winery: { userId } } },
    select: {
      id: true,
      status: true,
      experienceId: true,
      experience: {
        select: {
          slug: true,
          status: true,
          maxCapacity: true,
          winery: { select: { slug: true } },
        },
      },
    },
  });
}

/**
 * P-13 (P-05 debt): occurrence management on an ARCHIVED experience is
 * refused SERVER-SIDE — the UI's canEdit gate alone was bypassable.
 */
const ARCHIVED_CONFLICT = {
  success: false as const,
  error: {
    code: 'CONFLICT' as const,
    message: 'This experience is archived',
  },
};

function invalidateOccurrenceCaches(
  experienceId: string,
  winerySlug: string,
  experienceSlug: string
) {
  invalidateExperienceCaches(winerySlug, experienceSlug);
  // Forward-looking tag: occurrence reads are React.cache only today
  // (per-request), so fresh data comes from the action's router.refresh —
  // the tag exists so a future unstable_cache subscriber invalidates
  // without touching every action.
  revalidateTag(`occurrences:${experienceId}`);
}

/**
 * Shared close/reopen path — identical ritual, only the target status,
 * the CONFLICT wording and the log event differ. CANCELLED is terminal
 * either way (refunds already ran — reopening would resell a session the
 * clients were told is off).
 */
async function setOccurrenceStatus(
  input: unknown,
  target: typeof OccurrenceStatus.OPEN | typeof OccurrenceStatus.CLOSED,
  actionName: 'closeOccurrence' | 'reopenOccurrence'
): Promise<ActionResult<{ status: OccurrenceStatus }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }
    const parsed = occurrenceIdSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid occurrence' },
      };
    }
    const occurrence = await loadOwnedOccurrence(
      parsed.data.occurrenceId,
      session.user.id
    );
    if (!occurrence) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Occurrence not found' },
      };
    }
    if (occurrence.experience.status === ExperienceStatus.ARCHIVED) {
      return ARCHIVED_CONFLICT;
    }
    if (occurrence.status === OccurrenceStatus.CANCELLED) {
      return {
        success: false,
        error: {
          code: 'CONFLICT',
          message:
            target === OccurrenceStatus.CLOSED
              ? 'A cancelled occurrence cannot be closed'
              : 'A cancelled occurrence cannot be reopened',
        },
      };
    }

    const updated = await db.experienceOccurrence.update({
      where: { id: occurrence.id },
      data: { status: target },
      select: { status: true },
    });
    // Structure change → owner calendar + public availability refresh.
    invalidateOccurrenceCaches(
      occurrence.experienceId,
      occurrence.experience.winery.slug,
      occurrence.experience.slug
    );
    logInfo(
      target === OccurrenceStatus.CLOSED
        ? 'occurrence.closed'
        : 'occurrence.reopened',
      {
        action: actionName,
        occurrenceId: occurrence.id,
        experienceId: occurrence.experienceId,
        userId: session.user.id,
      }
    );
    return { success: true, data: { status: updated.status } };
  } catch (error) {
    logError(`${actionName} error`, error, { action: actionName });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}

export async function closeOccurrence(
  input: unknown
): Promise<ActionResult<{ status: OccurrenceStatus }>> {
  return setOccurrenceStatus(input, OccurrenceStatus.CLOSED, 'closeOccurrence');
}

export async function reopenOccurrence(
  input: unknown
): Promise<ActionResult<{ status: OccurrenceStatus }>> {
  return setOccurrenceStatus(input, OccurrenceStatus.OPEN, 'reopenOccurrence');
}

export async function setOccurrenceCapacity(
  input: unknown
): Promise<ActionResult<{ capacityOverride: number | null }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }
    const parsed = setOccurrenceCapacitySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid capacity' },
      };
    }
    const occurrence = await loadOwnedOccurrence(
      parsed.data.occurrenceId,
      session.user.id
    );
    if (!occurrence) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Occurrence not found' },
      };
    }
    if (occurrence.experience.status === ExperienceStatus.ARCHIVED) {
      return ARCHIVED_CONFLICT;
    }

    // Lowering below the already-booked count is allowed (it only blocks
    // NEW bookings — sold tickets are never clawed back), same doctrine
    // as closing. The DB CHECK enforces >= 1.
    const updated = await db.experienceOccurrence.update({
      where: { id: occurrence.id },
      data: { capacityOverride: parsed.data.capacityOverride },
      select: { capacityOverride: true },
    });
    invalidateOccurrenceCaches(
      occurrence.experienceId,
      occurrence.experience.winery.slug,
      occurrence.experience.slug
    );
    logInfo('occurrence.capacity_updated', {
      action: 'setOccurrenceCapacity',
      occurrenceId: occurrence.id,
      experienceId: occurrence.experienceId,
      capacityOverride: parsed.data.capacityOverride,
      userId: session.user.id,
    });
    return {
      success: true,
      data: { capacityOverride: updated.capacityOverride },
    };
  } catch (error) {
    logError('setOccurrenceCapacity error', error, {
      action: 'setOccurrenceCapacity',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}

async function loadOwnedExperience(experienceId: string, userId: string) {
  return db.experience.findFirst({
    where: { id: experienceId, winery: { userId } },
    select: {
      id: true,
      slug: true,
      status: true,
      winery: { select: { slug: true } },
    },
  });
}

export async function addPunctualOccurrences(
  input: unknown
): Promise<ActionResult<{ created: number }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }
    const parsed = addPunctualOccurrencesSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid dates' },
      };
    }
    const experience = await loadOwnedExperience(
      parsed.data.experienceId,
      session.user.id
    );
    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }
    if (experience.status === ExperienceStatus.ARCHIVED) {
      return ARCHIVED_CONFLICT;
    }

    const { created } = await createPunctualOccurrences(
      experience.id,
      parsed.data.picks.map((pick) => ({
        date: new Date(`${pick.date}T00:00:00.000Z`),
        startTime: pick.startTime,
      }))
    );
    invalidateOccurrenceCaches(
      experience.id,
      experience.winery.slug,
      experience.slug
    );
    logInfo('occurrence.punctual_added', {
      action: 'addPunctualOccurrences',
      experienceId: experience.id,
      created,
      userId: session.user.id,
    });
    return { success: true, data: { created } };
  } catch (error) {
    logError('addPunctualOccurrences error', error, {
      action: 'addPunctualOccurrences',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}
