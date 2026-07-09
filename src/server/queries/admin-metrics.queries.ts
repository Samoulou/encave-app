import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { startOfMonth, endOfMonth } from 'date-fns';
import { BookingStatus, GiftCardStatus } from '@prisma/client';
import { db } from '@/server/db';

export const ADMIN_METRICS_CACHE_TAG = 'admin-metrics';

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

const REVENUE_STATUSES = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

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
