import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { db } from '@/server/db';
import { BookingStatus } from '@prisma/client';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { findEmptySheetSessions } from '@/server/queries/wine.queries';
import { sendTastingSheetReminderEmail } from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailFailed,
} from '@/server/services/email-log.service';
import { zonedDateKey, zonedHourOf } from '@/lib/datetime/zurich';
import { getBaseUrl } from '@/lib/env';
import { logError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** The reminder goes out at 21h local (Europe/Zurich) — L-063. */
const REMINDER_LOCAL_HOUR = 21;

/**
 * Email #21 « fiche dégustation à remplir » (P-07 / L-063). Scheduled at
 * BOTH 19:00 and 20:00 UTC in vercel.json; the guard below lets exactly
 * the run matching 21h Europe/Zurich act (CET in winter, CEST in summer)
 * — DST-proof without touching the schedule twice a year. One email per
 * winery, listing every session of the day that ended with an empty
 * sheet; dedup = one EmailLog row per winery per Zurich day.
 */
export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const startedAt = Date.now();
  const now = new Date();

  try {
    if (!(await isFlagEnabled('TASTING_SHEET'))) {
      return NextResponse.json({ skipped: 'flag_off' });
    }
    if (zonedHourOf(now) !== REMINDER_LOCAL_HOUR) {
      return NextResponse.json({ skipped: 'not_local_reminder_hour' });
    }

    const todayKey = zonedDateKey(now);
    const todayUTC = new Date(`${todayKey}T00:00:00.000Z`);
    // Wineries with at least one active booking today.
    const wineryIds = await db.booking.groupBy({
      by: ['wineryId'],
      where: {
        date: todayUTC,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      },
    });

    const results = { wineries: 0, sent: 0, failed: 0, skipped: 0 };
    for (const { wineryId } of wineryIds) {
      try {
        const sessions = await findEmptySheetSessions({ wineryId, now });
        if (sessions.length === 0) continue;
        results.wineries++;

        // Dedup: one reminder per winery per Zurich day (the double UTC
        // schedule and any manual re-run must not double-send).
        const alreadySent = await db.emailLog.count({
          where: {
            type: 'tasting_sheet_reminder',
            wineryId,
            status: 'sent',
            createdAt: { gte: new Date(`${todayKey}T00:00:00.000Z`) },
          },
        });
        if (alreadySent > 0) {
          results.skipped++;
          continue;
        }

        const winery = await db.winery.findUnique({
          where: { id: wineryId },
          select: {
            email: true,
            user: { select: { name: true, preferredLocale: true } },
          },
        });
        if (!winery) continue;

        const firstSession = sessions[0];
        if (!firstSession) continue;
        const success = await sendTastingSheetReminderEmail(
          winery.email,
          {
            wineryId,
            firstName: winery.user.name ?? '',
            sessions: sessions.map((session) => ({
              experienceTitle: session.experienceTitle,
              timeSlot: session.timeSlot,
              attendeeCount: session.attendeeCount,
            })),
            sheetUrl: `${getBaseUrl()}/fr/dashboard/experiences/${firstSession.experienceId}/sessions`,
          },
          winery.user.preferredLocale
        );
        if (success) {
          await logEmailSent('tasting_sheet_reminder', winery.email, undefined, {
            wineryId,
          });
          results.sent++;
        } else {
          await logEmailFailed(
            'tasting_sheet_reminder',
            winery.email,
            'Failed to send',
            undefined,
            { wineryId }
          );
          results.failed++;
        }
      } catch (error) {
        results.failed++;
        logError('tasting-sheet-reminder error for winery', error, {
          action: 'cronTastingSheetReminder',
          wineryId,
        });
      }
    }

    logInfo('tasting_sheet_reminder.cron', {
      action: 'cronTastingSheetReminder',
      ...results,
    });
    return NextResponse.json({
      ...results,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logError('tasting-sheet-reminder cron error', error, {
      action: 'cronTastingSheetReminder',
    });
    return NextResponse.json(
      { error: 'Internal server error', durationMs: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
