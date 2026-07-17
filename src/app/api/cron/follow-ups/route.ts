import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { verifyCronRequest } from '@/lib/cron-auth';
import { withCronMonitor } from '@/lib/cron-monitor';
import { sendPostExperienceFollowUpEmail } from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailFailed,
  logEmailSkipped,
} from '@/server/services/email-log.service';
import { startOfDay, subHours } from 'date-fns';
import { zonedWallClockToUTC } from '@/lib/datetime/zurich';
import { BookingStatus, ScheduledJobStatus } from '@prisma/client';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { tastingRecapDedupeKey } from '@/lib/constants/wine';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function toDateOnlyUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
}

function getBookingStartTime(date: Date, timeSlot: string): Date {
  // @db.Date is UTC-midnight; timeSlot is a Europe/Zurich wall-clock.
  return zonedWallClockToUTC(date, timeSlot);
}

export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results = { sent: 0, failed: 0, skippedRecapArmed: 0 };

  try {
    // P-16 (WS-E): Sentry check-in — a missed run = dead cron alert.
    return await withCronMonitor('encave-follow-ups', async () => {
      // Find completed bookings whose session ended at least ~22h ago. This is
      // OPEN-ENDED below (no lower window bound): a booking missed on one daily
      // run is caught on the next, with followUpSentAt as the idempotency guard
      // — the old 4h band [now-26h, now-22h] on a once-daily cron skipped, then
      // permanently aged out, every session ending outside that narrow slice.
      const followUpCutoff = subHours(now, 22);
      const bookings = await db.booking.findMany({
        where: {
          status: BookingStatus.COMPLETED,
          followUpSentAt: null,
          // 72h floor recovers a fully-missed cron day (the previous 48h floor
          // dropped bookings whose single eligible run was skipped).
          date: {
            gte: toDateOnlyUTC(startOfDay(subHours(now, 72))),
            lte: toDateOnlyUTC(startOfDay(followUpCutoff)),
          },
        },
        include: {
          experience: true,
          winery: true,
        },
      });

      // P-07 / D4: when the tasting loop is ON and a booking has a recap
      // armed (a non-CANCELLED TASTING_RECAP job — the sheet was filled),
      // the generic J+1 follow-up is SKIPPED: the J+2 « coups de cœur »
      // replaces it. Flag OFF = this whole block is inert (empty Set).
      const recapArmed = new Set<string>();
      if (bookings.length > 0 && (await isFlagEnabled('TASTING_SHEET'))) {
        const jobs = await db.scheduledJob.findMany({
          where: {
            dedupeKey: { in: bookings.map((b) => tastingRecapDedupeKey(b.id)) },
            // Armed = will be (or was) delivered. FAILED is deliberately
            // NOT armed: if the recap died permanently, the generic J+1
            // follow-up must still go out — never zero post-visit emails.
            status: {
              in: [
                ScheduledJobStatus.PENDING,
                ScheduledJobStatus.PROCESSING,
                ScheduledJobStatus.DONE,
              ],
            },
          },
          select: { dedupeKey: true },
        });
        for (const job of jobs) {
          if (job.dedupeKey) recapArmed.add(job.dedupeKey);
        }
      }

      // Filter by actual experience end time
      for (const booking of bookings) {
        try {
          // Parse the time slot and calculate when experience ended
          const bookingStartTime = getBookingStartTime(
            booking.date,
            booking.timeSlot
          );

          // Add experience duration to get end time
          const experienceEndTime = new Date(
            bookingStartTime.getTime() + booking.experience.duration * 60 * 1000
          );

          // Only skip a session that is still too recent (< 22h). No lower
          // bound → a session missed on one run is caught the next; the
          // followUpSentAt guard (set on success) prevents a double send.
          if (experienceEndTime > followUpCutoff) {
            continue;
          }

          // D4 skip — deliberately WITHOUT setting followUpSentAt: nothing was
          // sent (the J+2 recap replaces it). This booking re-appears on later
          // runs until its date passes the 72h floor, always hitting this skip
          // (never a duplicate email — the branch below never sends).
          if (recapArmed.has(tastingRecapDedupeKey(booking.id))) {
            await logEmailSkipped(
              'follow_up',
              booking.visitorEmail,
              'tasting_recap_armed',
              booking.id
            );
            results.skippedRecapArmed++;
            continue;
          }

          const success = await sendPostExperienceFollowUpEmail(
            booking.visitorEmail,
            {
              guestName: booking.visitorName,
              experienceTitle: booking.experience.title,
              wineryName: booking.winery.name,
              date: bookingStartTime,
            },
            booking.locale
          );

          if (success) {
            await db.booking.update({
              where: { id: booking.id },
              data: { followUpSentAt: new Date() },
            });
            await logEmailSent('follow_up', booking.visitorEmail, booking.id);
            results.sent++;
          } else {
            await logEmailFailed(
              'follow_up',
              booking.visitorEmail,
              'Failed to send',
              booking.id
            );
            results.failed++;
          }
        } catch (error) {
          logError('FollowUps cron error for booking', error, {
            action: 'cronFollowUps',
            bookingId: booking.id,
          });
          await logEmailFailed(
            'follow_up',
            booking.visitorEmail,
            error instanceof Error ? error.message : 'Unknown error',
            booking.id
          );
          results.failed++;
        }
      }

      return NextResponse.json({
        success: true,
        results,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    logError('FollowUps cron error', error, { action: 'cronFollowUps' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
