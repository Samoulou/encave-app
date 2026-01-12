import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { verifyCronRequest } from '@/lib/cron-auth';
import { sendWeeklySummaryEmail } from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailFailed,
  logEmailSkipped,
} from '@/server/services/email-log.service';
import { startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { BookingStatus, WineryStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Last week: Monday to Sunday of the previous week
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  // This week: Monday to Sunday of the current week
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const results = { sent: 0, failed: 0, skipped: 0 };

  try {
    // Get all verified wineries with weekly summary enabled
    const wineries = await db.winery.findMany({
      where: {
        status: WineryStatus.VERIFIED,
        OR: [
          { notificationPreferences: null }, // Default to enabled
          { notificationPreferences: { weeklySummary: true } },
        ],
      },
      include: {
        user: true,
        notificationPreferences: true,
      },
    });

    for (const winery of wineries) {
      try {
        // Get last week's completed bookings
        const lastWeekBookings = await db.booking.findMany({
          where: {
            wineryId: winery.id,
            status: BookingStatus.COMPLETED,
            date: {
              gte: lastWeekStart,
              lte: lastWeekEnd,
            },
          },
        });

        // Get this week's upcoming bookings
        const thisWeekBookings = await db.booking.findMany({
          where: {
            wineryId: winery.id,
            status: BookingStatus.CONFIRMED,
            date: {
              gte: thisWeekStart,
              lte: thisWeekEnd,
            },
          },
        });

        // Calculate stats
        const lastWeekStats = {
          bookings: lastWeekBookings.length,
          guests: lastWeekBookings.reduce((sum, b) => sum + b.guestCount, 0),
          revenue: lastWeekBookings.reduce((sum, b) => sum + b.wineryPayout, 0),
        };

        const thisWeekPreview = {
          bookings: thisWeekBookings.length,
          guests: thisWeekBookings.reduce((sum, b) => sum + b.guestCount, 0),
        };

        // Skip if no activity
        if (lastWeekStats.bookings === 0 && thisWeekPreview.bookings === 0) {
          await logEmailSkipped('weekly_summary', winery.id, 'No activity');
          results.skipped++;
          continue;
        }

        const success = await sendWeeklySummaryEmail(
          winery.email,
          {
            winemakerName: winery.user.name || 'Winemaker',
            wineryName: winery.name,
            lastWeekStats,
            thisWeekPreview,
          },
          winery.user.preferredLocale
        );

        if (success) {
          await logEmailSent('weekly_summary', winery.id);
          results.sent++;
        } else {
          await logEmailFailed('weekly_summary', winery.id, 'Failed to send');
          results.failed++;
        }
      } catch (error) {
        console.error(`[Cron/WeeklySummary] Error for winery ${winery.id}:`, error);
        await logEmailFailed(
          'weekly_summary',
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
    console.error('[Cron/WeeklySummary] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
