import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { verifyCronRequest } from '@/lib/cron-auth';
import { withCronMonitor } from '@/lib/cron-monitor';
import { sendDailyDigestEmail } from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailFailed,
  logEmailSkipped,
} from '@/server/services/email-log.service';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { BookingStatus, WineryStatus } from '@prisma/client';
import { mapWithConcurrency } from '@/lib/utils/concurrency';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const today = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrow = addDays(today, 1);
  const tomorrowEnd = endOfDay(tomorrow);

  const results = { sent: 0, failed: 0, skipped: 0 };

  try {
    // P-16 (WS-E): Sentry check-in — a missed run = dead cron alert.
    return await withCronMonitor('encave-daily-digest', async () => {
      // Get all verified wineries with daily digest enabled (or no preferences = default enabled)
      const wineries = await db.winery.findMany({
        where: {
          status: WineryStatus.VERIFIED,
          OR: [
            { notificationPreferences: null }, // No preferences = default to enabled
            { notificationPreferences: { dailyDigest: true } },
          ],
        },
        include: {
          user: true,
          notificationPreferences: true,
        },
      });

      // P-16 (WS-F / L-208+L-211): ONE grouped query for the whole window
      // instead of 2 per winery, selecting only what the email renders
      // (the old `include: { experience: true }` dragged full descriptions).
      const windowBookings = await db.booking.findMany({
        where: {
          wineryId: { in: wineries.map((w) => w.id) },
          status: BookingStatus.CONFIRMED,
          date: { gte: today, lte: tomorrowEnd },
        },
        select: {
          wineryId: true,
          date: true,
          timeSlot: true,
          guestCount: true,
          visitorName: true,
          experience: { select: { title: true } },
        },
        orderBy: { timeSlot: 'asc' },
      });
      type DigestBooking = (typeof windowBookings)[number];
      const bookingsByWinery = new Map<
        string,
        { today: DigestBooking[]; tomorrow: DigestBooking[] }
      >();
      for (const booking of windowBookings) {
        const bucket = bookingsByWinery.get(booking.wineryId) ?? {
          today: [],
          tomorrow: [],
        };
        (booking.date <= todayEnd ? bucket.today : bucket.tomorrow).push(
          booking
        );
        bookingsByWinery.set(booking.wineryId, bucket);
      }

      // Bounded concurrency (L-211): parallel enough to finish at N caves,
      // low enough to stay under the Resend send rate.
      await mapWithConcurrency(wineries, 5, async (winery) => {
        try {
          const { today: todayBookings, tomorrow: tomorrowBookings } =
            bookingsByWinery.get(winery.id) ?? { today: [], tomorrow: [] };

          // Skip if no bookings today or tomorrow
          if (todayBookings.length === 0 && tomorrowBookings.length === 0) {
            await logEmailSkipped('daily_digest', winery.id, 'No bookings');
            results.skipped++;
            return;
          }

          const success = await sendDailyDigestEmail(
            winery.email,
            {
              winemakerName: winery.user.name || 'Winemaker',
              wineryName: winery.name,
              todayBookings: todayBookings.map((b) => ({
                time: b.timeSlot,
                experienceTitle: b.experience.title,
                guestName: b.visitorName,
                guestCount: b.guestCount,
              })),
              tomorrowBookings: tomorrowBookings.map((b) => ({
                time: b.timeSlot,
                experienceTitle: b.experience.title,
                guestName: b.visitorName,
                guestCount: b.guestCount,
              })),
            },
            winery.user.preferredLocale
          );

          if (success) {
            await logEmailSent('daily_digest', winery.id);
            results.sent++;
          } else {
            await logEmailFailed('daily_digest', winery.id, 'Failed to send');
            results.failed++;
          }
        } catch (error) {
          logError('DailyDigest cron error for winery', error, {
            action: 'cronDailyDigest',
            wineryId: winery.id,
          });
          await logEmailFailed(
            'daily_digest',
            winery.id,
            error instanceof Error ? error.message : 'Unknown error'
          );
          results.failed++;
        }
      });

      return NextResponse.json({
        success: true,
        results,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    logError('DailyDigest cron error', error, { action: 'cronDailyDigest' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
