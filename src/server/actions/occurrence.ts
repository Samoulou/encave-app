'use server';

import { revalidateTag } from 'next/cache';
import { OccurrenceStatus } from '@prisma/client';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import type { ActionResult } from '@/types/actions';
import { logError, logInfo } from '@/lib/logger';
import {
  occurrenceIdSchema,
  setOccurrenceCapacitySchema,
  addPunctualOccurrencesSchema,
  regenerateOccurrencesSchema,
} from '@/lib/validators/occurrence';
import {
  createPunctualOccurrences,
  generateOccurrences,
} from '@/server/services/occurrence.service';
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
          maxCapacity: true,
          winery: { select: { slug: true } },
        },
      },
    },
  });
}

function invalidateOccurrenceCaches(
  experienceId: string,
  winerySlug: string,
  experienceSlug: string
) {
  invalidateExperienceCaches(winerySlug, experienceSlug);
  revalidateTag(`occurrences:${experienceId}`);
}

export async function closeOccurrence(
  input: unknown
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
    if (occurrence.status === OccurrenceStatus.CANCELLED) {
      return {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A cancelled occurrence cannot be closed',
        },
      };
    }

    const updated = await db.experienceOccurrence.update({
      where: { id: occurrence.id },
      data: { status: OccurrenceStatus.CLOSED },
      select: { status: true },
    });
    // Structure change → owner calendar + public availability refresh.
    invalidateOccurrenceCaches(
      occurrence.experienceId,
      occurrence.experience.winery.slug,
      occurrence.experience.slug
    );
    logInfo('occurrence.closed', {
      action: 'closeOccurrence',
      occurrenceId: occurrence.id,
      experienceId: occurrence.experienceId,
      userId: session.user.id,
    });
    return { success: true, data: { status: updated.status } };
  } catch (error) {
    logError('closeOccurrence error', error, { action: 'closeOccurrence' });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}

export async function reopenOccurrence(
  input: unknown
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
    if (occurrence.status === OccurrenceStatus.CANCELLED) {
      return {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A cancelled occurrence cannot be reopened',
        },
      };
    }

    const updated = await db.experienceOccurrence.update({
      where: { id: occurrence.id },
      data: { status: OccurrenceStatus.OPEN },
      select: { status: true },
    });
    invalidateOccurrenceCaches(
      occurrence.experienceId,
      occurrence.experience.winery.slug,
      occurrence.experience.slug
    );
    logInfo('occurrence.reopened', {
      action: 'reopenOccurrence',
      occurrenceId: occurrence.id,
      experienceId: occurrence.experienceId,
      userId: session.user.id,
    });
    return { success: true, data: { status: updated.status } };
  } catch (error) {
    logError('reopenOccurrence error', error, { action: 'reopenOccurrence' });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
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
    select: { id: true, slug: true, winery: { select: { slug: true } } },
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

export async function regenerateOccurrences(
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
    const parsed = regenerateOccurrencesSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid experience' },
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

    const { created } = await generateOccurrences(experience.id);
    invalidateOccurrenceCaches(
      experience.id,
      experience.winery.slug,
      experience.slug
    );
    return { success: true, data: { created } };
  } catch (error) {
    logError('regenerateOccurrences error', error, {
      action: 'regenerateOccurrences',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}
