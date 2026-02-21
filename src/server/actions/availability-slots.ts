'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { hasOverlappingSlots } from '@/lib/constants/time-slots';
import type { ActionResult } from '@/types/actions';
import { logError } from '@/lib/logger';

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
    logError('getAvailabilitySlots error', error, { action: 'getAvailabilitySlots', experienceId });
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
    logError('updateAvailabilitySlots error', error, { action: 'updateAvailabilitySlots', experienceId });
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
    logError('toggleSlotActive error', error, { action: 'toggleSlotActive' });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to toggle slot. Please try again.',
      },
    };
  }
}
