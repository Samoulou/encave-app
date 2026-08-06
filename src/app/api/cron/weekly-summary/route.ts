import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { verifyCronRequest } from '@/lib/cron-auth';
import { withCronMonitor } from '@/lib/cron-monitor';
import { sendWeeklySummaryEmail } from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailFailed,
  logEmailSkipped,
} from '@/server/services/email-log.service';
import { startOfWeek, endOfWeek, subWeeks, subMonths, format } from 'date-fns';
import { BookingStatus, WineryStatus } from '@prisma/client';
import { mapWithConcurrency } from '@/lib/utils/concurrency';
import { listRecentPaidPayouts } from '@/server/queries/payouts.queries';
import { formatDate } from '@/lib/i18n/formatters';
import { logError, logWarn } from '@/lib/logger';
import type { Locale as AppLocale } from '@/i18n/routing';

export const dynamic = 'force-dynamic';
// Sequential per-winery work (2 booking queries + Stripe payouts.list +
// Resend send) — 60s would cut the loop mid-way at a few dozen wineries.
export const maxDuration = 300;

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
    // P-16 (WS-E): Sentry check-in — a missed run = dead cron alert.
    return await withCronMonitor('encave-weekly-summary', async () => {
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

      // P-16 (WS-F / L-211): ONE grouped query over both windows instead
      // of 2 per winery, selecting only the 3 aggregated fields.
      const windowBookings = await db.booking.findMany({
        where: {
          wineryId: { in: wineries.map((w) => w.id) },
          OR: [
            {
              status: BookingStatus.COMPLETED,
              date: { gte: lastWeekStart, lte: lastWeekEnd },
            },
            {
              status: BookingStatus.CONFIRMED,
              date: { gte: thisWeekStart, lte: thisWeekEnd },
            },
          ],
        },
        select: {
          wineryId: true,
          status: true,
          guestCount: true,
          wineryPayout: true,
        },
      });
      const statsByWinery = new Map<
        string,
        {
          lastWeek: { bookings: number; guests: number; revenue: number };
          thisWeek: { bookings: number; guests: number };
        }
      >();
      for (const booking of windowBookings) {
        const stats = statsByWinery.get(booking.wineryId) ?? {
          lastWeek: { bookings: 0, guests: 0, revenue: 0 },
          thisWeek: { bookings: 0, guests: 0 },
        };
        if (booking.status === BookingStatus.COMPLETED) {
          stats.lastWeek.bookings++;
          stats.lastWeek.guests += booking.guestCount;
          stats.lastWeek.revenue += booking.wineryPayout;
        } else {
          stats.thisWeek.bookings++;
          stats.thisWeek.guests += booking.guestCount;
        }
        statsByWinery.set(booking.wineryId, stats);
      }

      // Bounded concurrency (L-211): each iteration also hits Stripe
      // (payouts.list) — 4 keeps both Stripe and Resend comfortable.
      await mapWithConcurrency(wineries, 4, async (winery) => {
        try {
          const stats = statsByWinery.get(winery.id);
          const lastWeekStats = stats?.lastWeek ?? {
            bookings: 0,
            guests: 0,
            revenue: 0,
          };
          const thisWeekPreview = stats?.thisWeek ?? {
            bookings: 0,
            guests: 0,
          };

          // Skip if no activity
          if (lastWeekStats.bookings === 0 && thisWeekPreview.bookings === 0) {
            await logEmailSkipped('weekly_summary', winery.id, 'No activity');
            results.skipped++;
            return;
          }

          // Real Stripe payouts of the last 7 days (P-13 / email #17).
          // Fail-safe: a Stripe hiccup must never block the summary itself.
          let payouts: { totalCents: number; count: number } | null = null;
          if (winery.stripeAccountId) {
            try {
              const paid = await listRecentPaidPayouts(
                winery.stripeAccountId,
                7
              );
              if (paid.length > 0) {
                payouts = {
                  totalCents: paid.reduce((sum, p) => sum + p.amountCents, 0),
                  count: paid.length,
                };
              }
            } catch (error) {
              logWarn('Weekly summary: payouts lookup failed, sent without', {
                action: 'cronWeeklySummary',
                wineryId: winery.id,
                error: error instanceof Error ? error.message : 'unknown',
              });
            }
          }

          const appLocale = (
            winery.user.preferredLocale ?? 'FR'
          ).toLowerCase() as AppLocale;
          const previousMonth = subMonths(now, 1);
          const statement = {
            monthKey: format(previousMonth, 'yyyy-MM'),
            monthLabel: formatDate(previousMonth, appLocale, {
              month: 'long',
              year: 'numeric',
            }),
          };

          const success = await sendWeeklySummaryEmail(
            winery.email,
            {
              winemakerName: winery.user.name || 'Winemaker',
              wineryName: winery.name,
              lastWeekStats,
              thisWeekPreview,
              payouts,
              statement,
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
          logError('WeeklySummary cron error for winery', error, {
            action: 'cronWeeklySummary',
            wineryId: winery.id,
          });
          await logEmailFailed(
            'weekly_summary',
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
    logError('WeeklySummary cron error', error, {
      action: 'cronWeeklySummary',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
