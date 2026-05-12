'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { BookingStatus } from '@prisma/client';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { logError, logInfo } from '@/lib/logger';
import { bookingIdSchema } from '@/lib/validators/eventDetail';
import { parseTimeSlot, timeSlotSchema } from '@/lib/validators/booking';
import type { ActionResult } from '@/types/actions';
import type { BookingDTO } from '@/types/event-detail';

/**
 * Server actions for the winemaker event detail page (ENC-096).
 *
 * Distinct from src/server/actions/booking-dashboard.ts:
 *  - `markBookingNoShow` here requires the session to have ENDED (defense in
 *    depth — UI also disables it before that);
 *  - the revert actions are the ONLY place where the booking state machine
 *    is allowed to step backwards. Every revert is logged via Pino as
 *    decided by Margot (2026-05-12).
 *  - reverts are bounded to a 72h window after `session.endsAt` (Margot
 *    decision, no Luca solicitation). Past that window we surface a typed
 *    error code so the client can show a localised explanation.
 */

const SESSION_TIMEZONE = 'Europe/Zurich';
const REVERT_WINDOW_MS = 72 * 60 * 60 * 1000;

type BookingActionData = { booking: BookingDTO };

interface AuthorizedBooking {
  id: string;
  status: BookingStatus;
  guestCount: number;
  date: Date;
  timeSlot: string;
  experience: {
    id: string;
    slug: string;
    duration: number;
    winery: { id: string; userId: string };
  };
}

interface ResolvedContext {
  userId: string;
  booking: AuthorizedBooking;
}

/**
 * Mirror of zonedWallClockToUTC in event-detail.queries.ts — kept local to the
 * action layer to avoid coupling queries → actions. If this helper grows
 * a third caller, hoist it to `src/lib/i18n/formatters.ts`.
 */
function zonedWallClockToUTC(date: Date, timeSlot: string): Date {
  const { hours, minutes } = parseTimeSlot(timeSlot);
  const wallUTC = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours,
      minutes,
      0,
      0
    )
  );
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SESSION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(wallUTC);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      lookup[part.type] = part.value;
    }
  }
  const zoneAsUTC = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour === '24' ? '0' : lookup.hour),
    Number(lookup.minute),
    Number(lookup.second)
  );
  const offsetMs = zoneAsUTC - wallUTC.getTime();
  return new Date(wallUTC.getTime() - offsetMs);
}

function getSessionEndsAt(booking: AuthorizedBooking): Date | null {
  if (!timeSlotSchema.safeParse(booking.timeSlot).success) return null;
  const startsAt = zonedWallClockToUTC(booking.date, booking.timeSlot);
  return new Date(startsAt.getTime() + booking.experience.duration * 60_000);
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
      date: true,
      timeSlot: true,
      experience: {
        select: {
          id: true,
          slug: true,
          duration: true,
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

/**
 * Cache invalidation after a booking mutation on the event-detail page.
 *
 * Tag consumers (must match emitters here):
 *   - `event-detail:<slug>` → consumed by `getEventDetail` in
 *     `src/server/queries/event-detail.queries.ts`.
 *
 * Path consumers (other dashboard views rely on React.cache only — bumping the
 * Next router cache forces a fresh render):
 *   - `/dashboard/bookings` → list + calendar views in
 *     `src/app/[locale]/(protected)/dashboard/bookings/`.
 */
function invalidate(experienceSlug: string): void {
  revalidateTag(`event-detail:${experienceSlug}`);
  revalidatePath('/dashboard/bookings');
}

async function loadBookingDTO(bookingId: string): Promise<BookingDTO | null> {
  const fresh = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      reference: true,
      visitorName: true,
      visitorEmail: true,
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

    invalidate(booking.experience.slug);

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
 * Mark a CONFIRMED booking as NO_SHOW. Requires the session to have ended
 * (defense in depth: the UI also disables the action until `endsAt <= now`).
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

  const endsAt = getSessionEndsAt(booking);
  if (!endsAt || endsAt.getTime() > Date.now()) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'SESSION_NOT_ENDED',
      },
    };
  }

  try {
    await db.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.NO_SHOW },
    });

    invalidate(booking.experience.slug);

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
 * Reject a revert request issued more than 72h after the session ended.
 * Margot decision (2026-05-12): no operational latitude past this window.
 */
function checkRevertWindow(
  booking: AuthorizedBooking
): ActionResult<undefined> {
  const endsAt = getSessionEndsAt(booking);
  if (!endsAt) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'REVERT_WINDOW_EXPIRED',
      },
    };
  }
  if (endsAt.getTime() + REVERT_WINDOW_MS < Date.now()) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'REVERT_WINDOW_EXPIRED',
      },
    };
  }
  return { success: true, data: undefined };
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

  const windowCheck = checkRevertWindow(booking);
  if (!windowCheck.success) return windowCheck;

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

    invalidate(booking.experience.slug);

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

  const windowCheck = checkRevertWindow(booking);
  if (!windowCheck.success) return windowCheck;

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

    invalidate(booking.experience.slug);

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
