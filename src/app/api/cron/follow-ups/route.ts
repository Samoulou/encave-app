import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { verifyCronRequest } from '@/lib/cron-auth';
import { sendPostExperienceFollowUpEmail } from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailFailed,
  logEmailSkipped,
} from '@/server/services/email-log.service';
import { startOfDay, subHours } from 'date-fns';
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
  const [hours, minutes] = timeSlot.split(':').map(Number);
  const bookingStartTime = new Date(date);
  bookingStartTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return bookingStartTime;
}

export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results = { sent: 0, failed: 0, skippedRecapArmed: 0 };

  try {
    // Find completed bookings that ended 22-26 hours ago
    // (experience date + time slot was 22-26 hours ago)
    // We check COMPLETED status which means the experience has occurred
    const windowStart = subHours(now, 26);
    const windowEnd = subHours(now, 22);
    const bookings = await db.booking.findMany({
      where: {
        status: BookingStatus.COMPLETED,
        followUpSentAt: null,
        // Look for bookings that completed yesterday or earlier
        date: {
          gte: toDateOnlyUTC(startOfDay(subHours(now, 48))),
          lte: toDateOnlyUTC(startOfDay(windowEnd)),
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

        if (experienceEndTime < windowStart || experienceEndTime > windowEnd) {
          continue;
        }

        // D4 skip — deliberately WITHOUT setting followUpSentAt: nothing
        // was sent, and the 22-26h window keeps it from re-matching.
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
          }
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
  } catch (error) {
    logError('FollowUps cron error', error, { action: 'cronFollowUps' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
