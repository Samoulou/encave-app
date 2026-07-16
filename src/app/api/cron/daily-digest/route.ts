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

      for (const winery of wineries) {
        try {
          // Get today's and tomorrow's bookings in parallel
          const [todayBookings, tomorrowBookings] = await Promise.all([
            db.booking.findMany({
              where: {
                wineryId: winery.id,
                status: BookingStatus.CONFIRMED,
                date: {
                  gte: today,
                  lte: todayEnd,
                },
              },
              include: {
                experience: true,
              },
              orderBy: { timeSlot: 'asc' },
            }),
            db.booking.findMany({
              where: {
                wineryId: winery.id,
                status: BookingStatus.CONFIRMED,
                date: {
                  gte: tomorrow,
                  lte: tomorrowEnd,
                },
              },
              include: {
                experience: true,
              },
              orderBy: { timeSlot: 'asc' },
            }),
          ]);

          // Skip if no bookings today or tomorrow
          if (todayBookings.length === 0 && tomorrowBookings.length === 0) {
            await logEmailSkipped('daily_digest', winery.id, 'No bookings');
            results.skipped++;
            continue;
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
      }

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
