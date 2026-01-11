'use server';

import { z } from 'zod';
import { db } from '@/server/db';
import type { ActionResult } from '@/types/actions';
import { BookingStatus } from '@prisma/client';

const CheckAvailabilitySchema = z.object({
  experienceId: z.string(),
  date: z.string(),
  timeSlot: z.string(),
});

export interface AvailabilityResult {
  available: boolean;
  remainingCapacity: number;
  maxCapacity: number;
  bookedCount: number;
}

export async function checkAvailability(
  input: z.infer<typeof CheckAvailabilitySchema>
): Promise<ActionResult<AvailabilityResult>> {
  try {
    const validated = CheckAvailabilitySchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      };
    }

    const { experienceId, date, timeSlot } = validated.data;

    const experience = await db.experience.findUnique({
      where: { id: experienceId },
      select: { maxCapacity: true },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    // Parse date string to Date object for comparison
    const bookingDate = new Date(date);

    // Get total booked guests for this slot
    const bookedGuests = await db.booking.aggregate({
      where: {
        experienceId,
        date: bookingDate,
        timeSlot,
        status: {
          in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED],
        },
      },
      _sum: { guestCount: true },
    });

    const bookedCount = bookedGuests._sum.guestCount ?? 0;
    const remainingCapacity = experience.maxCapacity - bookedCount;

    return {
      success: true,
      data: {
        available: remainingCapacity > 0,
        remainingCapacity,
        maxCapacity: experience.maxCapacity,
        bookedCount,
      },
    };
  } catch (error) {
    console.error('checkAvailability error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to check availability' },
    };
  }
}

export interface TimeSlotAvailability {
  timeSlot: string;
  remainingCapacity: number;
  available: boolean;
}

export async function getTimeSlotsForDate(
  experienceId: string,
  date: string
): Promise<ActionResult<TimeSlotAvailability[]>> {
  try {
    const bookingDate = new Date(date);
    const dayOfWeek = bookingDate.getDay();

    // Get experience with its availability slots for this day
    const experience = await db.experience.findUnique({
      where: { id: experienceId },
      include: {
        availabilitySlots: {
          where: {
            dayOfWeek,
            isActive: true,
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    // Get all bookings for this date
    const bookings = await db.booking.groupBy({
      by: ['timeSlot'],
      where: {
        experienceId,
        date: bookingDate,
        status: {
          in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED],
        },
      },
      _sum: { guestCount: true },
    });

    const bookingsBySlot = new Map(
      bookings.map((b) => [b.timeSlot, b._sum.guestCount ?? 0])
    );

    const slots: TimeSlotAvailability[] = experience.availabilitySlots.map(
      (slot) => {
        const bookedCount = bookingsBySlot.get(slot.startTime) ?? 0;
        const remainingCapacity = experience.maxCapacity - bookedCount;
        return {
          timeSlot: slot.startTime,
          remainingCapacity,
          available: remainingCapacity > 0,
        };
      }
    );

    return { success: true, data: slots };
  } catch (error) {
    console.error('getTimeSlotsForDate error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get time slots' },
    };
  }
}

export interface ExperienceForBooking {
  id: string;
  title: string;
  slug: string;
  price: number;
  minCapacity: number;
  maxCapacity: number;
  duration: number;
  coverPhoto: string;
  winery: {
    id: string;
    name: string;
    stripeOnboardingComplete: boolean;
  };
  availabilitySlots: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
}

export async function getExperienceForBooking(
  slug: string
): Promise<ActionResult<ExperienceForBooking>> {
  try {
    const experience = await db.experience.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
        winery: { status: 'VERIFIED' },
      },
      include: {
        winery: {
          select: {
            id: true,
            name: true,
            stripeOnboardingComplete: true,
          },
        },
        availabilitySlots: {
          where: { isActive: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
        },
      },
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
        id: experience.id,
        title: experience.title,
        slug: experience.slug,
        price: experience.price,
        minCapacity: experience.minCapacity,
        maxCapacity: experience.maxCapacity,
        duration: experience.duration,
        coverPhoto: experience.coverPhoto,
        winery: experience.winery,
        availabilitySlots: experience.availabilitySlots,
      },
    };
  } catch (error) {
    console.error('getExperienceForBooking error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get experience' },
    };
  }
}
