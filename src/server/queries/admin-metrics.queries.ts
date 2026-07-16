import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { startOfMonth, endOfMonth } from 'date-fns';
import { BookingStatus, GiftCardStatus } from '@prisma/client';
import { db } from '@/server/db';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';
import { zonedWallClockToUTC } from '@/lib/datetime/zurich';

export const ADMIN_METRICS_CACHE_TAG = 'admin-metrics';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AdminBusinessKpis {
  /** GMV in cents — totalPrice of CONFIRMED + COMPLETED bookings. */
  gmvCents: number;
  /** Tickets (guestCount sum) for bookings dated in the current month. */
  ticketsThisMonth: number;
  /** Blended take rate in % — (platformFee + serviceFeeCents) / GMV. */
  takeRatePercent: number;
  /** Gift-card revenue in cents — initialAmount sum, all cards. */
  giftCardRevenueCents: number;
  /** Gift-card liability in cents — balance sum of ACTIVE cards. */
  giftCardLiabilityCents: number;
}

// NO_SHOW bookings kept the client's money — they count as revenue.
const REVENUE_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
];

/**
 * Business KPIs for the admin dashboard (P-03 / L-045).
 * Read-only aggregation, cached 5 minutes — dashboards tolerate slight
 * staleness; no action revalidates the tag today, the TTL does the job.
 */
export const getAdminBusinessKpis = cache(
  unstable_cache(
    async (): Promise<AdminBusinessKpis> => {
      const now = new Date();

      const [revenueAgg, monthAgg, giftCardAgg, liabilityAgg] =
        await Promise.all([
          db.booking.aggregate({
            where: { status: { in: REVENUE_STATUSES } },
            _sum: {
              totalPrice: true,
              platformFee: true,
              serviceFeeCents: true,
            },
          }),
          db.booking.aggregate({
            where: {
              status: { in: REVENUE_STATUSES },
              date: { gte: startOfMonth(now), lte: endOfMonth(now) },
            },
            _sum: { guestCount: true },
          }),
          db.giftCard.aggregate({ _sum: { initialAmount: true } }),
          db.giftCard.aggregate({
            where: { status: GiftCardStatus.ACTIVE },
            _sum: { balance: true },
          }),
        ]);

      const gmvCents = revenueAgg._sum.totalPrice ?? 0;
      const platformRevenueCents =
        (revenueAgg._sum.platformFee ?? 0) +
        (revenueAgg._sum.serviceFeeCents ?? 0);

      return {
        gmvCents,
        ticketsThisMonth: monthAgg._sum.guestCount ?? 0,
        takeRatePercent:
          gmvCents > 0 ? (platformRevenueCents / gmvCents) * 100 : 0,
        giftCardRevenueCents: giftCardAgg._sum.initialAmount ?? 0,
        giftCardLiabilityCents: liabilityAgg._sum.balance ?? 0,
      };
    },
    ['admin-business-kpis'],
    { revalidate: 300, tags: [ADMIN_METRICS_CACHE_TAG] }
  )
);

export interface TodayAdminKpis {
  /** GMV in cents of bookings CREATED today (sales velocity). */
  bookedTodayCents: number;
  /** Number of revenue bookings created today. */
  bookingsTodayCount: number;
  /** Number of sessions HAPPENING today (field activity). */
  tastingsTodayCount: number;
  /** Total guests across today's sessions. */
  guestsTodayCount: number;
}

/**
 * "Aujourd'hui" KPIs for the admin dashboard (P-15 / L-160). Two distinct
 * axes, both anchored to the Europe/Zurich calendar day:
 *  - booked-today: `createdAt` within [Zurich 00:00, next 00:00) as real UTC
 *    instants (DST-correct via zonedWallClockToUTC);
 *  - tastings-today: `date` (a `@db.Date` UTC-midnight) equal to today's
 *    Zurich calendar date.
 *
 * Request-level `cache()` only — NO persistent cache: the landing is an ops
 * surface and a stale "0 today" is worse than a fresh indexed count.
 */
export const getTodayAdminKpis = cache(async (): Promise<TodayAdminKpis> => {
  const now = new Date();
  const todayDate = zurichTodayAsUTCDate(now);
  const tomorrowDate = new Date(todayDate.getTime() + DAY_MS);
  const dayStart = zonedWallClockToUTC(todayDate, '00:00');
  const dayEnd = zonedWallClockToUTC(tomorrowDate, '00:00');

  const [bookedAgg, tastingsAgg] = await Promise.all([
    db.booking.aggregate({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      _sum: { totalPrice: true },
      _count: true,
    }),
    db.booking.aggregate({
      where: {
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        date: todayDate,
      },
      _sum: { guestCount: true },
      _count: true,
    }),
  ]);

  return {
    bookedTodayCents: bookedAgg._sum.totalPrice ?? 0,
    bookingsTodayCount: bookedAgg._count,
    tastingsTodayCount: tastingsAgg._count,
    guestsTodayCount: tastingsAgg._sum.guestCount ?? 0,
  };
});
