'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { BookingStatus } from '@prisma/client';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { checkInBookingSchema } from '@/lib/validators/checkIn';
import {
  API_RATE_LIMIT,
  checkRateLimit,
} from '@/server/services/rate-limit.service';
import type { ActionResult } from '@/types/actions';

interface CheckInBookingData {
  code: 'CHECKED_IN' | 'ALREADY_CHECKED_IN';
  booking: {
    id: string;
    reference: string;
    visitorName: string;
    guestCount: number;
    status: BookingStatus;
    checkedInAt: Date | null;
    experienceTitle: string;
  };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function checkInBooking(
  input: unknown
): Promise<ActionResult<CheckInBookingData>> {
  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    };
  }

  const parsed = checkInBookingSchema.safeParse(input);
  if (!parsed.success || (!parsed.data.token && !parsed.data.bookingId)) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid check-in input' },
    };
  }

  const rateLimit = await checkRateLimit(
    `check-in:${session.user.id}`,
    API_RATE_LIMIT
  );
  if (!rateLimit.success) {
    return {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many check-in attempts' },
    };
  }

  try {
    const booking = await db.booking.findFirst({
      where: parsed.data.token
        ? { accessTokenHash: hashToken(parsed.data.token) }
        : { id: parsed.data.bookingId },
      select: {
        id: true,
        reference: true,
        visitorName: true,
        guestCount: true,
        status: true,
        checkedInAt: true,
        date: true,
        timeSlot: true,
        experience: {
          select: {
            id: true,
            title: true,
            slug: true,
            winery: {
              select: {
                userId: true,
              },
            },
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

    if (booking.experience.winery.userId !== session.user.id) {
      logWarn('Forbidden check-in attempt', {
        action: 'checkInBooking',
        bookingId: booking.id,
        actorId: session.user.id,
      });
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not your booking' },
      };
    }

    const expectedSessionId = parsed.data.expectedSessionId;
    const actualSessionId = `${booking.date.toISOString().slice(0, 10)}|${booking.timeSlot}`;
    if (expectedSessionId && expectedSessionId !== actualSessionId) {
      return {
        success: false,
        error: {
          code: 'WRONG_SESSION',
          message: booking.experience.title,
        },
      };
    }

    if (booking.status === BookingStatus.COMPLETED) {
      return {
        success: true,
        data: {
          code: 'ALREADY_CHECKED_IN',
          booking: {
            id: booking.id,
            reference: booking.reference,
            visitorName: booking.visitorName,
            guestCount: booking.guestCount,
            status: booking.status,
            checkedInAt: booking.checkedInAt,
            experienceTitle: booking.experience.title,
          },
        },
      };
    }

    if (booking.status === BookingStatus.PENDING_PAYMENT) {
      return {
        success: false,
        error: {
          code: 'PAYMENT_NOT_CONFIRMED',
          message: 'Payment not confirmed',
        },
      };
    }

    if (
      booking.status === BookingStatus.CANCELLED_BY_CLIENT ||
      booking.status === BookingStatus.CANCELLED_BY_WINERY
    ) {
      return {
        success: false,
        error: { code: 'BOOKING_CANCELLED', message: 'Booking cancelled' },
      };
    }

    if (booking.status === BookingStatus.NO_SHOW) {
      return {
        success: false,
        error: { code: 'MARKED_NO_SHOW', message: 'Booking marked no-show' },
      };
    }

    const checkedInAt = new Date();
    const updateResult = await db.booking.updateMany({
      where: { id: booking.id, status: BookingStatus.CONFIRMED },
      data: {
        status: BookingStatus.COMPLETED,
        checkedInAt,
      },
    });

    if (updateResult.count !== 1) {
      return {
        success: false,
        error: {
          code: 'ALREADY_CHECKED_IN',
          message: 'Booking was already updated',
        },
      };
    }

    const updated = await db.booking.findUnique({
      where: { id: booking.id },
      select: {
        id: true,
        reference: true,
        visitorName: true,
        guestCount: true,
        status: true,
        checkedInAt: true,
      },
    });
    if (!updated) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      };
    }

    revalidatePath('/dashboard/bookings');
    logInfo('booking.check_in', {
      bookingRef: booking.reference,
      actorId: session.user.id,
      source: parsed.data.source,
    });

    return {
      success: true,
      data: {
        code: 'CHECKED_IN',
        booking: {
          ...updated,
          experienceTitle: booking.experience.title,
        },
      },
    };
  } catch (error) {
    logError('checkInBooking failed', error, { action: 'checkInBooking' });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to check in booking' },
    };
  }
}
