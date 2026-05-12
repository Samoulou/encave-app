'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import type { ActionResult } from '@/types/actions';
import { logError } from '@/lib/logger';

/**
 * Normalize a date to UTC midnight to avoid timezone issues.
 * This ensures the same date is stored/queried regardless of client timezone.
 */
function normalizeToUTCDate(date: Date): Date {
  const d = new Date(date);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

interface BlockDateResult {
  id: string;
  experienceId: string;
  date: Date;
}

/**
 * Block a specific date for an experience
 */
export async function blockDate(
  experienceId: string,
  date: Date,
  reason?: string
): Promise<ActionResult<BlockDateResult>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };
    }

    // Verify ownership
    const experience = await db.experience.findUnique({
      where: { id: experienceId },
      include: { winery: { select: { userId: true } } },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    if (experience.winery.userId !== session.user.id) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      };
    }

    // Normalize date to UTC to avoid timezone issues
    const normalizedDate = normalizeToUTCDate(date);

    // Check if already blocked
    const existing = await db.blockedDate.findUnique({
      where: {
        experienceId_date: {
          experienceId,
          date: normalizedDate,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: 'Date is already blocked' },
      };
    }

    // Create blocked date
    const blockedDate = await db.blockedDate.create({
      data: {
        experienceId,
        date: normalizedDate,
        reason,
      },
    });

    return {
      success: true,
      data: {
        id: blockedDate.id,
        experienceId: blockedDate.experienceId,
        date: blockedDate.date,
      },
    };
  } catch (error) {
    logError('blockDate error', error, { action: 'blockDate', experienceId });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to block date' },
    };
  }
}

/**
 * Unblock a date for an experience
 */
export async function unblockDate(
  experienceId: string,
  date: Date
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };
    }

    // Verify ownership
    const experience = await db.experience.findUnique({
      where: { id: experienceId },
      include: { winery: { select: { userId: true } } },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    if (experience.winery.userId !== session.user.id) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      };
    }

    // Normalize date to UTC to avoid timezone issues
    const normalizedDate = normalizeToUTCDate(date);

    // Delete blocked date
    await db.blockedDate.deleteMany({
      where: {
        experienceId,
        date: normalizedDate,
      },
    });

    return { success: true, data: { success: true } };
  } catch (error) {
    logError('unblockDate error', error, {
      action: 'unblockDate',
      experienceId,
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to unblock date' },
    };
  }
}

/**
 * Block a date for all experiences of a winery
 */
export async function blockDateForAllExperiences(
  date: Date,
  reason?: string
): Promise<ActionResult<{ blockedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };
    }

    // Get winery and all published experiences
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      include: {
        experiences: {
          where: { status: 'PUBLISHED' },
          select: { id: true },
        },
      },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    // Normalize date to UTC to avoid timezone issues
    const normalizedDate = normalizeToUTCDate(date);

    // Block date for all experiences in a single batch operation
    const result = await db.blockedDate.createMany({
      data: winery.experiences.map((experience) => ({
        experienceId: experience.id,
        date: normalizedDate,
        reason,
      })),
      skipDuplicates: true,
    });

    return { success: true, data: { blockedCount: result.count } };
  } catch (error) {
    logError('blockDateForAllExperiences error', error, {
      action: 'blockDateForAllExperiences',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to block date' },
    };
  }
}

/**
 * Unblock a date for all experiences of a winery
 */
export async function unblockDateForAllExperiences(
  date: Date
): Promise<ActionResult<{ unblockedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };
    }

    // Get winery
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    // Normalize date to UTC to avoid timezone issues
    const normalizedDate = normalizeToUTCDate(date);

    // Delete all blocked dates for this winery on this date
    const result = await db.blockedDate.deleteMany({
      where: {
        date: normalizedDate,
        experience: { wineryId: winery.id },
      },
    });

    return { success: true, data: { unblockedCount: result.count } };
  } catch (error) {
    logError('unblockDateForAllExperiences error', error, {
      action: 'unblockDateForAllExperiences',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to unblock date' },
    };
  }
}

/**
 * Get blocked dates for a specific experience
 */
export async function getBlockedDatesForExperience(
  experienceId: string
): Promise<ActionResult<{ dates: Date[] }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };
    }

    // Verify ownership
    const experience = await db.experience.findUnique({
      where: { id: experienceId },
      include: { winery: { select: { userId: true } } },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    if (experience.winery.userId !== session.user.id) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      };
    }

    const blockedDates = await db.blockedDate.findMany({
      where: { experienceId },
      select: { date: true },
      orderBy: { date: 'asc' },
    });

    return {
      success: true,
      data: { dates: blockedDates.map((bd) => bd.date) },
    };
  } catch (error) {
    logError('getBlockedDatesForExperience error', error, {
      action: 'getBlockedDatesForExperience',
      experienceId,
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get blocked dates' },
    };
  }
}
