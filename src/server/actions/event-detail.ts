'use server';

import { revalidateTag } from 'next/cache';
import { BookingStatus } from '@prisma/client';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { logError, logInfo } from '@/lib/logger';
import { bookingIdSchema } from '@/lib/validators/eventDetail';
import type { ActionResult } from '@/types/actions';
import type { BookingDTO } from '@/types/event-detail';

/**
 * Server actions for the winemaker event detail page (ENC-096).
 *
 * Distinct from src/server/actions/booking-dashboard.ts:
 *  - `markBookingNoShow` here does NOT require the booking time to be past
 *    (a no-show can be recorded as soon as the encaveur knows it);
 *  - the revert actions are the ONLY place where the booking state machine
 *    is allowed to step backwards. Every revert is logged via Pino as
 *    decided by Margot (2026-05-12).
 */

type BookingActionData = { booking: BookingDTO };

interface AuthorizedBooking {
  id: string;
  status: BookingStatus;
  guestCount: number;
  experience: {
    id: string;
    slug: string;
    winery: { id: string; userId: string };
  };
}

interface ResolvedContext {
  userId: string;
  booking: AuthorizedBooking;
}

async function resolveContext(
  bookingId: string
): Promise<ActionResult<ResolvedContext>> {
  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    };
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      guestCount: true,
      experience: {
        select: {
          id: true,
          slug: true,
          winery: { select: { id: true, userId: true } },
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
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Not the owner of this booking' },
    };
  }

  return {
    success: true,
    data: { userId: session.user.id, booking },
  };
}

function invalidate(
  experienceSlug: string,
  userId: string,
  experienceId: string
): void {
  revalidateTag(`event-detail:${experienceSlug}`);
  revalidateTag(`winery-user:${userId}:bookings`);
  // Reuse the existing convention so the rest of the dashboard sees the change.
  revalidateTag(`experience:${experienceId}:bookings`);
}

async function loadBookingDTO(bookingId: string): Promise<BookingDTO | null> {
  const fresh = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      reference: true,
      visitorName: true,
      visitorEmail: true,
      visitorPhone: true,
      guestCount: true,
      status: true,
      checkedInAt: true,
      createdAt: true,
    },
  });
  return fresh satisfies BookingDTO | null;
}

/**
 * Manually mark a CONFIRMED booking as checked-in (COMPLETED).
 * Used when the encaveur scans nothing and ticks the guest off the list.
 */
export async function markBookingCheckedIn(
  input: unknown
): Promise<ActionResult<BookingActionData>> {
  const parsed = bookingIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid booking id' },
    };
  }

  const ctx = await resolveContext(parsed.data.bookingId);
  if (!ctx.success) return ctx;
  const { booking, userId } = ctx.data;

  if (booking.status !== BookingStatus.CONFIRMED) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Only confirmed bookings can be checked in',
      },
    };
  }

  try {
    await db.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.COMPLETED,
        checkedInAt: new Date(),
      },
    });

    invalidate(booking.experience.slug, userId, booking.experience.id);

    const dto = await loadBookingDTO(booking.id);
    if (!dto) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found after update' },
      };
    }

    return { success: true, data: { booking: dto } };
  } catch (error) {
    logError('markBookingCheckedIn failed', error, {
      action: 'markBookingCheckedIn',
      bookingId: booking.id,
      userId,
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to check in booking' },
    };
  }
}

/**
 * Mark a CONFIRMED booking as NO_SHOW (no time-of-day guard — distinct from
 * the booking-dashboard action which requires the booking to be in the past).
 */
export async function markBookingNoShow(
  input: unknown
): Promise<ActionResult<BookingActionData>> {
  const parsed = bookingIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid booking id' },
    };
  }

  const ctx = await resolveContext(parsed.data.bookingId);
  if (!ctx.success) return ctx;
  const { booking, userId } = ctx.data;

  if (booking.status !== BookingStatus.CONFIRMED) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Only confirmed bookings can be marked as no-show',
      },
    };
  }

  try {
    await db.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.NO_SHOW },
    });

    invalidate(booking.experience.slug, userId, booking.experience.id);

    const dto = await loadBookingDTO(booking.id);
    if (!dto) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found after update' },
      };
    }

    return { success: true, data: { booking: dto } };
  } catch (error) {
    logError('markBookingNoShow failed', error, {
      action: 'markBookingNoShow',
      bookingId: booking.id,
      userId,
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark booking as no-show',
      },
    };
  }
}

/**
 * Revert a COMPLETED booking back to CONFIRMED (operational fix).
 * Logged with Pino as decided by Margot (2026-05-12).
 */
export async function revertBookingCheckIn(
  input: unknown
): Promise<ActionResult<BookingActionData>> {
  const parsed = bookingIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid booking id' },
    };
  }

  const ctx = await resolveContext(parsed.data.bookingId);
  if (!ctx.success) return ctx;
  const { booking, userId } = ctx.data;

  if (booking.status !== BookingStatus.COMPLETED) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Only completed bookings can have their check-in reverted',
      },
    };
  }

  try {
    await db.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CONFIRMED,
        checkedInAt: null,
      },
    });

    logInfo('booking.revert.checkin', {
      bookingId: booking.id,
      actorId: userId,
      from: BookingStatus.COMPLETED,
      to: BookingStatus.CONFIRMED,
    });

    invalidate(booking.experience.slug, userId, booking.experience.id);

    const dto = await loadBookingDTO(booking.id);
    if (!dto) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found after update' },
      };
    }

    return { success: true, data: { booking: dto } };
  } catch (error) {
    logError('revertBookingCheckIn failed', error, {
      action: 'revertBookingCheckIn',
      bookingId: booking.id,
      userId,
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to revert check-in',
      },
    };
  }
}

/**
 * Revert a NO_SHOW booking back to CONFIRMED (operational fix).
 * Logged with Pino as decided by Margot (2026-05-12).
 */
export async function revertBookingNoShow(
  input: unknown
): Promise<ActionResult<BookingActionData>> {
  const parsed = bookingIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid booking id' },
    };
  }

  const ctx = await resolveContext(parsed.data.bookingId);
  if (!ctx.success) return ctx;
  const { booking, userId } = ctx.data;

  if (booking.status !== BookingStatus.NO_SHOW) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Only no-show bookings can have their no-show reverted',
      },
    };
  }

  try {
    await db.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CONFIRMED },
    });

    logInfo('booking.revert.noshow', {
      bookingId: booking.id,
      actorId: userId,
      from: BookingStatus.NO_SHOW,
      to: BookingStatus.CONFIRMED,
    });

    invalidate(booking.experience.slug, userId, booking.experience.id);

    const dto = await loadBookingDTO(booking.id);
    if (!dto) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found after update' },
      };
    }

    return { success: true, data: { booking: dto } };
  } catch (error) {
    logError('revertBookingNoShow failed', error, {
      action: 'revertBookingNoShow',
      bookingId: booking.id,
      userId,
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to revert no-show',
      },
    };
  }
}
