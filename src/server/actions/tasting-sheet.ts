'use server';

import { BookingStatus, ScheduledJobStatus } from '@prisma/client';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import type { ActionResult } from '@/types/actions';
import { logError, logInfo } from '@/lib/logger';
import { saveTastingSheetSchema } from '@/lib/validators/wine';
import {
  TASTING_RECAP_DELAY_HOURS,
  TASTING_RECAP_JOB_TYPE,
  tastingRecapDedupeKey,
} from '@/lib/constants/wine';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { zonedWallClockToUTC } from '@/lib/datetime/zurich';
import { HOLD_EMAIL_DOMAIN } from '@/lib/constants/booking-hold';

/**
 * Tasting sheet (P-07 / L-061, decision D1): filled once per SESSION,
 * fanned out as BookingWine rows to every active booking of
 * (experienceId, date, timeSlot), and armed as one TASTING_RECAP
 * ScheduledJob PER BOOKING (decision A1 — the job's existence is the
 * "recap armed" marker consumed by the J+1 follow-up skip, D4).
 */

export interface SaveTastingSheetResult {
  bookingCount: number;
  wineCount: number;
  /** When the J+2 recap will run (null when the sheet was cleared). */
  recapRunAt: Date | null;
}

export async function saveTastingSheet(
  input: unknown
): Promise<ActionResult<SaveTastingSheetResult>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }
    if (!(await isFlagEnabled('TASTING_SHEET'))) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'This feature is not available' },
      };
    }
    const parsed = saveTastingSheetSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid tasting sheet' },
      };
    }
    const { experienceId, date, timeSlot } = parsed.data;
    const wineIds = Array.from(new Set(parsed.data.wineIds));

    // Tenant gate — the experience must belong to the caller's winery.
    const experience = await db.experience.findFirst({
      where: { id: experienceId, winery: { userId: session.user.id } },
      select: { id: true, duration: true, wineryId: true },
    });
    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    // Every toggled wine must belong to the same winery.
    if (wineIds.length > 0) {
      const ownedWines = await db.wine.count({
        where: { id: { in: wineIds }, wineryId: experience.wineryId },
      });
      if (ownedWines !== wineIds.length) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Unknown wine' },
        };
      }
    }

    const sessionDate = new Date(`${date}T00:00:00.000Z`);
    // Active bookings of the session (A5): CONFIRMED + COMPLETED, never
    // holds (sentinel email), never cancelled/no-show.
    const bookings = await db.booking.findMany({
      where: {
        experienceId,
        date: sessionDate,
        timeSlot,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        NOT: { visitorEmail: { endsWith: `@${HOLD_EMAIL_DOMAIN}` } },
      },
      select: { id: true },
    });

    // D2: the recap runs at max(session end + 48h, now) — a sheet filled
    // after J+2 goes out on the next cron pass.
    const now = new Date();
    const sessionEnd = new Date(
      zonedWallClockToUTC(sessionDate, timeSlot).getTime() +
        experience.duration * 60 * 1000
    );
    const recapRunAt = new Date(
      Math.max(
        sessionEnd.getTime() + TASTING_RECAP_DELAY_HOURS * 60 * 60 * 1000,
        now.getTime()
      )
    );

    await db.$transaction(async (tx) => {
      for (const booking of bookings) {
        // Sync the sheet: drop unchecked wines, add checked ones.
        await tx.bookingWine.deleteMany({
          where: { bookingId: booking.id, wineId: { notIn: wineIds } },
        });
        if (wineIds.length > 0) {
          await tx.bookingWine.createMany({
            data: wineIds.map((wineId) => ({ bookingId: booking.id, wineId })),
            skipDuplicates: true,
          });
        }
      }

      const dedupeKeys = bookings.map((b) => tastingRecapDedupeKey(b.id));
      if (wineIds.length === 0) {
        // Sheet cleared: disarm the pending recaps (A1). PROCESSING/DONE/
        // FAILED are never touched — an email already in flight stays.
        await tx.scheduledJob.updateMany({
          where: {
            dedupeKey: { in: dedupeKeys },
            status: ScheduledJobStatus.PENDING,
          },
          data: {
            status: ScheduledJobStatus.CANCELLED,
            lastError: 'tasting_sheet_cleared',
          },
        });
        return;
      }

      const existingJobs = await tx.scheduledJob.findMany({
        where: { dedupeKey: { in: dedupeKeys } },
        select: { id: true, dedupeKey: true, status: true },
      });
      const jobByKey = new Map(existingJobs.map((j) => [j.dedupeKey, j]));
      for (const booking of bookings) {
        const dedupeKey = tastingRecapDedupeKey(booking.id);
        const existing = jobByKey.get(dedupeKey);
        if (!existing) {
          await tx.scheduledJob.create({
            data: {
              type: TASTING_RECAP_JOB_TYPE,
              runAt: recapRunAt,
              status: ScheduledJobStatus.PENDING,
              payload: { bookingId: booking.id },
              dedupeKey,
            },
          });
        } else if (existing.status === ScheduledJobStatus.CANCELLED) {
          // Cleared then re-filled: re-arm.
          await tx.scheduledJob.update({
            where: { id: existing.id },
            data: {
              status: ScheduledJobStatus.PENDING,
              runAt: recapRunAt,
              attempts: 0,
              lastError: null,
            },
          });
        }
        // PENDING keeps its runAt (already max(end+48h, first-fill time));
        // PROCESSING/DONE/FAILED are never re-armed.
      }
    });

    logInfo('tasting_sheet.saved', {
      action: 'saveTastingSheet',
      experienceId,
      date,
      timeSlot,
      wineCount: wineIds.length,
      bookingCount: bookings.length,
      userId: session.user.id,
    });
    return {
      success: true,
      data: {
        bookingCount: bookings.length,
        wineCount: wineIds.length,
        recapRunAt:
          wineIds.length > 0 && bookings.length > 0 ? recapRunAt : null,
      },
    };
  } catch (error) {
    logError('saveTastingSheet error', error, { action: 'saveTastingSheet' });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}
