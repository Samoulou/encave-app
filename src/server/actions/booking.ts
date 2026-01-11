'use server';

import { z } from 'zod';
import crypto from 'crypto';
import { db } from '@/server/db';
import type { ActionResult } from '@/types/actions';
import { BookingStatus } from '@prisma/client';
import { sendBookingConfirmationEmail } from '@/server/services/email.service';

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

/**
 * Resend booking confirmation email
 */
export async function resendConfirmationEmail(
  bookingId: string
): Promise<ActionResult<{ sent: boolean }>> {
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        experience: {
          select: {
            title: true,
            duration: true,
          },
        },
        winery: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      };
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Booking is not confirmed' },
      };
    }

    // Combine date and timeSlot for email formatting
    const [hours, minutes] = booking.timeSlot.split(':').map(Number);
    const bookingDateTime = new Date(booking.date);
    bookingDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

    const sent = await sendBookingConfirmationEmail(
      booking.visitorEmail,
      {
        guestName: booking.visitorName,
        experienceTitle: booking.experience.title,
        wineryName: booking.winery.name,
        date: bookingDateTime,
        guestCount: booking.guestCount,
        duration: booking.experience.duration,
        totalPrice: booking.totalPrice,
        bookingRef: booking.reference,
      }
    );

    if (sent) {
      await db.booking.update({
        where: { id: bookingId },
        data: { confirmationSentAt: new Date() },
      });
    }

    return { success: true, data: { sent } };
  } catch (error) {
    console.error('resendConfirmationEmail error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to resend email' },
    };
  }
}

/**
 * Get booking by access token (for email links)
 */
export async function getBookingByToken(
  token: string
): Promise<ActionResult<{
  id: string;
  reference: string;
  status: BookingStatus;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  date: Date;
  timeSlot: string;
  guestCount: number;
  totalPrice: number;
  experience: {
    title: string;
    slug: string;
    duration: number;
    coverPhoto: string;
  };
  winery: {
    name: string;
    slug: string;
    address: string;
    commune: string;
    phone: string;
    email: string;
  };
}>> {
  try {
    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const booking = await db.booking.findFirst({
      where: {
        OR: [
          { accessToken: token },
          { accessTokenHash: tokenHash },
        ],
      },
      include: {
        experience: {
          select: {
            title: true,
            slug: true,
            duration: true,
            coverPhoto: true,
          },
        },
        winery: {
          select: {
            name: true,
            slug: true,
            address: true,
            commune: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found or invalid token' },
      };
    }

    return {
      success: true,
      data: {
        id: booking.id,
        reference: booking.reference,
        status: booking.status,
        visitorName: booking.visitorName,
        visitorEmail: booking.visitorEmail,
        visitorPhone: booking.visitorPhone,
        date: booking.date,
        timeSlot: booking.timeSlot,
        guestCount: booking.guestCount,
        totalPrice: booking.totalPrice,
        experience: booking.experience,
        winery: booking.winery,
      },
    };
  } catch (error) {
    console.error('getBookingByToken error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get booking' },
    };
  }
}
