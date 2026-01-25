import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { verifyCronRequest } from '@/lib/cron-auth';
import { sendDailyDigestEmail } from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailFailed,
  logEmailSkipped,
} from '@/server/services/email-log.service';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { BookingStatus, WineryStatus } from '@prisma/client';

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
        console.error(`[Cron/DailyDigest] Error for winery ${winery.id}:`, error);
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
  } catch (error) {
    console.error('[Cron/DailyDigest] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
