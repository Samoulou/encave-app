'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { hasOverlappingSlots } from '@/lib/constants/time-slots';
import type { ActionResult } from '@/types/actions';

/**
 * Normalize a date to UTC midnight to avoid timezone issues.
 * This ensures the same date is stored/queried regardless of client timezone.
 */
function normalizeToUTCDate(date: Date): Date {
  const d = new Date(date);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export interface AvailabilitySlotInput {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface AvailabilitySlotData {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

/**
 * Get availability slots for an experience
 */
export async function getAvailabilitySlots(
  experienceId: string
): Promise<ActionResult<AvailabilitySlotData[]>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    // Verify user owns this experience
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

    const experience = await db.experience.findFirst({
      where: { id: experienceId, wineryId: winery.id },
      select: { id: true },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    const slots = await db.availabilitySlot.findMany({
      where: { experienceId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return {
      success: true,
      data: slots.map((slot) => ({
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isActive: slot.isActive,
      })),
    };
  } catch (error) {
    console.error('getAvailabilitySlots error:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get availability slots. Please try again.',
      },
    };
  }
}

/**
 * Update availability slots for an experience
 * This replaces all existing slots with the new set
 */
export async function updateAvailabilitySlots(
  experienceId: string,
  slots: AvailabilitySlotInput[]
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    // Verify user owns this experience
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

    const experience = await db.experience.findFirst({
      where: { id: experienceId, wineryId: winery.id },
      select: { id: true },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    // Validate: check for overlapping slots per day
    const slotsByDay: Record<number, AvailabilitySlotInput[]> = {};
    for (const slot of slots) {
      const daySlots = slotsByDay[slot.dayOfWeek] ?? [];
      daySlots.push(slot);
      slotsByDay[slot.dayOfWeek] = daySlots;
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const day of Object.keys(slotsByDay)) {
      const dayOfWeek = parseInt(day);
      const daySlots = slotsByDay[dayOfWeek];
      if (daySlots && hasOverlappingSlots(daySlots)) {
        const dayName = dayNames[dayOfWeek];
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Overlapping time slots found on ${dayName}`,
          },
        };
      }
    }

    // Validate time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    for (const slot of slots) {
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid time format. Use HH:mm format.',
          },
        };
      }
      if (slot.startTime >= slot.endTime) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'End time must be after start time',
          },
        };
      }
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid day of week',
          },
        };
      }
    }

    // Update slots in transaction
    await db.$transaction(async (tx) => {
      // Delete all existing slots
      await tx.availabilitySlot.deleteMany({
        where: { experienceId },
      });

      // Create new slots
      if (slots.length > 0) {
        await tx.availabilitySlot.createMany({
          data: slots.map((slot) => ({
            experienceId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isActive: slot.isActive,
          })),
        });
      }
    });

    return {
      success: true,
      data: { count: slots.length },
    };
  } catch (error) {
    console.error('updateAvailabilitySlots error:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update availability. Please try again.',
      },
    };
  }
}

/**
 * Toggle a single slot's active status
 */
export async function toggleSlotActive(
  slotId: string,
  isActive: boolean
): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    // Verify user owns this slot's experience
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

    const slot = await db.availabilitySlot.findFirst({
      where: { id: slotId },
      include: {
        experience: {
          select: { wineryId: true },
        },
      },
    });

    if (!slot || slot.experience.wineryId !== winery.id) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Slot not found' },
      };
    }

    await db.availabilitySlot.update({
      where: { id: slotId },
      data: { isActive },
    });

    return {
      success: true,
      data: { isActive },
    };
  } catch (error) {
    console.error('toggleSlotActive error:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to toggle slot. Please try again.',
      },
    };
  }
}

// ============================================
// Blocked Date Functions
// ============================================

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
    console.error('blockDate error:', error);
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
    console.error('unblockDate error:', error);
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

    // Block date for each experience
    let blockedCount = 0;
    for (const experience of winery.experiences) {
      try {
        await db.blockedDate.create({
          data: {
            experienceId: experience.id,
            date: normalizedDate,
            reason,
          },
        });
        blockedCount++;
      } catch {
        // Skip if already blocked (unique constraint violation)
      }
    }

    return { success: true, data: { blockedCount } };
  } catch (error) {
    console.error('blockDateForAllExperiences error:', error);
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
    console.error('unblockDateForAllExperiences error:', error);
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
    console.error('getBlockedDatesForExperience error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get blocked dates' },
    };
  }
}
