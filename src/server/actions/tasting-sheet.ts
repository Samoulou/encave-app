'use server';

import crypto from 'crypto';
import { headers } from 'next/headers';
import { BookingStatus, Prisma, ScheduledJobStatus } from '@prisma/client';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import type { ActionResult } from '@/types/actions';
import { logError, logInfo } from '@/lib/logger';
import {
  saveTastingSheetSchema,
  submitWineOrderRequestSchema,
} from '@/lib/validators/wine';
import {
  TASTING_RECAP_DELAY_HOURS,
  TASTING_RECAP_JOB_TYPE,
  tastingRecapDedupeKey,
} from '@/lib/constants/wine';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { zonedWallClockToUTC } from '@/lib/datetime/zurich';
import { HOLD_EMAIL_DOMAIN } from '@/lib/constants/booking-hold';
import {
  checkRateLimit,
  getClientIp,
  WINE_ORDER_RATE_LIMIT,
} from '@/server/services/rate-limit.service';
import { sendWineOrderRequestEmails } from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailFailed,
} from '@/server/services/email-log.service';
import { getPostHogServer } from '@/lib/posthog';

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

/**
 * Public wine-order request from the J+2 recap (decision D3/A6): token-
 * authenticated (recap token, or the booking access token so the ticket
 * link works too), rate-limited, idempotent per booking (@unique →
 * CONFLICT = "already sent"). Never a GET — this is the 1-tap POST.
 */
export async function submitWineOrderRequest(
  input: unknown
): Promise<ActionResult<{ orderRequestId: string }>> {
  try {
    const parsed = submitWineOrderRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid order request' },
      };
    }
    const { bookingId, token, items } = parsed.data;

    // Public endpoint → per-IP budget (rule: rate-limit public endpoints).
    const ip = getClientIp(await headers());
    const rate = await checkRateLimit(
      `wine-order:${ip}`,
      WINE_ORDER_RATE_LIMIT
    );
    if (!rate.success) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
        },
      };
    }

    // Flag OFF answers NOT_FOUND too — the surface does not exist.
    if (!(await isFlagEnabled('TASTING_SHEET'))) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Not found' },
      };
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const booking = await db.booking.findFirst({
      where: {
        id: bookingId,
        OR: [{ recapTokenHash: tokenHash }, { accessTokenHash: tokenHash }],
      },
      select: {
        id: true,
        reference: true,
        visitorName: true,
        visitorEmail: true,
        visitorPhone: true,
        locale: true,
        winery: {
          select: {
            id: true,
            name: true,
            email: true,
            user: { select: { preferredLocale: true } },
          },
        },
        wines: { select: { wineId: true } },
      },
    });
    if (!booking) {
      // Unknown booking and bad token are indistinguishable on purpose.
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Not found' },
      };
    }

    // Only wines actually served at this tasting can be ordered.
    const servedWineIds = new Set(booking.wines.map((w) => w.wineId));
    if (items.some((item) => !servedWineIds.has(item.wineId))) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid order request' },
      };
    }
    // Collapse duplicate wineIds (defensive — the UI never produces them).
    const quantities = new Map<string, number>();
    for (const item of items) {
      quantities.set(
        item.wineId,
        (quantities.get(item.wineId) ?? 0) + item.quantity
      );
    }

    const wines = await db.wine.findMany({
      where: { id: { in: Array.from(quantities.keys()) } },
      select: {
        id: true,
        name: true,
        grapeVariety: true,
        vintage: true,
        price: true,
      },
    });

    let orderRequestId: string;
    try {
      const created = await db.wineOrderRequest.create({
        data: {
          bookingId: booking.id,
          wineryId: booking.winery.id,
          clientName: booking.visitorName,
          clientEmail: booking.visitorEmail,
          clientPhone: booking.visitorPhone,
          items: {
            create: wines.map((wine) => ({
              wineId: wine.id,
              wineName: wine.name,
              grapeVariety: wine.grapeVariety,
              vintage: wine.vintage,
              priceAtRequest: wine.price,
              quantity: quantities.get(wine.id) ?? 1,
            })),
          },
        },
        select: { id: true },
      });
      orderRequestId = created.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // The 1-tap already went through (double tap, retried request).
        return {
          success: false,
          error: { code: 'CONFLICT', message: 'Request already sent' },
        };
      }
      throw error;
    }

    const itemLines = wines.map((wine) => ({
      wineName: wine.name,
      vintage: wine.vintage,
      quantity: quantities.get(wine.id) ?? 1,
      priceAtRequest: wine.price,
    }));
    const totalCents = itemLines.reduce(
      (sum, line) => sum + line.priceAtRequest * line.quantity,
      0
    );
    const sent = await sendWineOrderRequestEmails(
      booking.winery.email,
      {
        bookingId: booking.id,
        wineryId: booking.winery.id,
        bookingReference: booking.reference,
        clientName: booking.visitorName,
        clientEmail: booking.visitorEmail,
        clientPhone: booking.visitorPhone,
        wineryName: booking.winery.name,
        items: itemLines,
        totalCents,
      },
      booking.winery.user.preferredLocale,
      booking.locale
    );
    if (sent.winery) {
      await logEmailSent(
        'wine_order_request',
        booking.winery.email,
        booking.id,
        { wineryId: booking.winery.id }
      );
    } else {
      // The request row exists (future Shop inbox) — surface the email
      // failure in the logs without failing the client.
      await logEmailFailed(
        'wine_order_request',
        booking.winery.email,
        'Failed to send',
        booking.id,
        { wineryId: booking.winery.id }
      );
    }

    const posthog = getPostHogServer();
    if (posthog) {
      posthog.capture({
        distinctId: booking.visitorEmail,
        event: 'wine_order_requested',
        properties: {
          bookingId: booking.id,
          wineryId: booking.winery.id,
          items: itemLines.length,
          totalCents,
        },
      });
      await posthog.flush();
    }

    logInfo('wine_order.requested', {
      action: 'submitWineOrderRequest',
      bookingId: booking.id,
      wineryId: booking.winery.id,
      orderRequestId,
    });
    return { success: true, data: { orderRequestId } };
  } catch (error) {
    logError('submitWineOrderRequest error', error, {
      action: 'submitWineOrderRequest',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}
