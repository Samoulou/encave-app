import { cache } from 'react';
import { db } from '@/server/db';
import { env } from '@/lib/env';
import { isMonthKey } from '@/lib/utils/date-key';
import {
  computeCommissionCents,
  getEffectiveCommissionRate,
} from '@/lib/business-rules/commission';
import { BookingStatus, NoShowChargeStatus, Prisma } from '@prisma/client';
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  format,
} from 'date-fns';

/**
 * P-13 (L-141): statuses are booking facts only — the old paid/processing
 * buckets were a J+5 business-day GUESS about Stripe payouts. Real payout
 * timing now lives on /dashboard/payouts (Stripe API).
 */
export type TransactionStatus = 'upcoming' | 'completed' | 'refunded';

export interface EarningsSummary {
  totalEarnings: number;
  thisMonth: number;
  lastMonth: number;
  yearToDate: number;
  currentMonthLabel: string;
}

export interface MonthlyEarning {
  month: string;
  monthLabel: string;
  revenue: number;
  payout: number;
  bookingCount: number;
}

export interface Transaction {
  id: string;
  date: Date;
  bookingId: string;
  experienceTitle: string;
  experienceId: string;
  customer: {
    name: string;
    avatarUrl?: string;
  };
  guestCount: number;
  grossAmount: number;
  platformFee: number;
  netPayout: number;
  status: TransactionStatus;
  reference: string;
}

export interface TransactionFilters {
  month?: string; // 'YYYY-MM'
  experienceId?: string;
  status?: TransactionStatus;
}

export interface YearToDateSummary {
  grossRevenue: number;
  platformFees: number;
  netEarnings: number;
  totalBookings: number;
  refundedAmount: number;
}

// Partial refunds (STRICT 50% tier) reverse the Stripe transfer
// proportionally: the winery keeps payout × (1 − refunded/paid). A full
// refund keeps nothing. refundIssued alone no longer implies "earned 0".
function refundedFraction(b: {
  totalPrice: number;
  serviceFeeCents: number;
  refundIssued: boolean;
  refundAmount: number | null;
}): number {
  if (!b.refundIssued) return 0;
  const paid = b.totalPrice + b.serviceFeeCents;
  if (paid <= 0 || b.refundAmount === null) return 1;
  return Math.min(1, b.refundAmount / paid);
}

/**
 * Get earnings summary for dashboard cards.
 * Wrapped with React.cache for request-level deduplication.
 */
export const getEarningsSummary = cache(async function getEarningsSummary(
  wineryId: string
): Promise<EarningsSummary> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const yearStart = startOfYear(now);

  // Get all completed/confirmed bookings
  const bookings = await db.booking.findMany({
    where: {
      wineryId,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
    },
    select: {
      wineryPayout: true,
      totalPrice: true,
      serviceFeeCents: true,
      refundAmount: true,
      date: true,
      status: true,
      refundIssued: true,
    },
  });

  // Total earnings (all time, net of full/partial refunds)
  // Only count bookings where experience has passed (date <= now)
  const totalEarnings = bookings
    .filter((b) => b.date <= now)
    .reduce(
      (sum, b) => sum + Math.round(b.wineryPayout * (1 - refundedFraction(b))),
      0
    );

  // This month earnings (experiences that happened this month)
  const thisMonth = bookings
    .filter(
      (b) => b.date >= monthStart && b.date <= monthEnd && b.date <= now // Only count completed experiences
    )
    .reduce(
      (sum, b) => sum + Math.round(b.wineryPayout * (1 - refundedFraction(b))),
      0
    );

  // Last month earnings (for trend calculation)
  const lastMonth = bookings
    .filter((b) => b.date >= lastMonthStart && b.date <= lastMonthEnd)
    .reduce(
      (sum, b) => sum + Math.round(b.wineryPayout * (1 - refundedFraction(b))),
      0
    );

  // Year to date (gross revenue)
  const yearToDate = bookings
    .filter((b) => b.date >= yearStart && b.date <= now)
    .reduce(
      (sum, b) => sum + Math.round(b.totalPrice * (1 - refundedFraction(b))),
      0
    );

  return {
    totalEarnings,
    thisMonth,
    lastMonth,
    yearToDate,
    currentMonthLabel: format(now, 'MMM'),
  };
});

/**
 * Get monthly earnings for chart (last N months).
 * Wrapped with React.cache for request-level deduplication.
 */
export const getMonthlyEarnings = cache(async function getMonthlyEarnings(
  wineryId: string,
  months: number = 6
): Promise<MonthlyEarning[]> {
  const now = new Date();

  // P-16 (WS-F / L-208): ONE query over the whole window, bucketed in JS —
  // the old shape ran N sequential findMany (one per month).
  const windowStart = startOfMonth(subMonths(now, months - 1));
  const windowEnd = endOfMonth(now);
  const bookings = await db.booking.findMany({
    where: {
      wineryId,
      date: { gte: windowStart, lte: windowEnd },
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      refundIssued: false,
    },
    select: {
      date: true,
      totalPrice: true,
      wineryPayout: true,
    },
  });

  const byMonth = new Map<
    string,
    { revenue: number; payout: number; bookingCount: number }
  >();
  for (const booking of bookings) {
    const key = format(booking.date, 'yyyy-MM');
    const bucket = byMonth.get(key) ?? {
      revenue: 0,
      payout: 0,
      bookingCount: 0,
    };
    bucket.revenue += booking.totalPrice;
    bucket.payout += booking.wineryPayout;
    bucket.bookingCount += 1;
    byMonth.set(key, bucket);
  }

  const results: MonthlyEarning[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const targetMonth = subMonths(now, i);
    const key = format(targetMonth, 'yyyy-MM');
    const bucket = byMonth.get(key) ?? {
      revenue: 0,
      payout: 0,
      bookingCount: 0,
    };
    results.push({
      month: key,
      monthLabel: format(targetMonth, 'MMM'),
      ...bucket,
    });
  }

  return results;
});

/**
 * Get transactions with filters.
 * Wrapped with React.cache for request-level deduplication.
 */
export const getTransactions = cache(async function getTransactions(
  wineryId: string,
  filters?: TransactionFilters
): Promise<Transaction[]> {
  const where: Prisma.BookingWhereInput = {
    wineryId,
    status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
  };

  // Month filter
  if (filters?.month) {
    const parts = filters.month.split('-').map(Number);
    const year = parts[0] ?? new Date().getFullYear();
    const month = parts[1] ?? 1;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = endOfMonth(monthStart);
    where.date = { gte: monthStart, lte: monthEnd };
  }

  // Experience filter
  if (filters?.experienceId) {
    where.experienceId = filters.experienceId;
  }

  const bookings = await db.booking.findMany({
    where,
    orderBy: { date: 'desc' },
    // P-16 (WS-F / L-208): hard bound — the unfiltered "all time" view was
    // unbounded. 500 rows ≫ anything the table renders; a winery that deep
    // in history filters by month anyway.
    take: 500,
    select: {
      id: true,
      reference: true,
      date: true,
      guestCount: true,
      totalPrice: true,
      platformFee: true,
      wineryPayout: true,
      status: true,
      refundIssued: true,
      visitorName: true,
      experience: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  // Booking facts only: refunded > upcoming (experience not held yet) >
  // completed. Payout timing is Stripe's job (/dashboard/payouts).
  const now = new Date();
  let transactions: Transaction[] = bookings.map((b) => {
    const status: TransactionStatus = b.refundIssued
      ? 'refunded'
      : b.date > now
        ? 'upcoming'
        : 'completed';

    return {
      id: b.id,
      date: b.date,
      bookingId: b.reference,
      experienceTitle: b.experience.title,
      experienceId: b.experience.id,
      customer: {
        name: b.visitorName,
        // avatarUrl would come from user profile if they're registered
        avatarUrl: undefined,
      },
      guestCount: b.guestCount,
      grossAmount: b.totalPrice,
      platformFee: b.platformFee,
      netPayout: b.wineryPayout,
      status,
      reference: b.reference,
    };
  });

  // Status filter (applied after calculation)
  if (filters?.status) {
    transactions = transactions.filter((t) => t.status === filters.status);
  }

  return transactions;
});

/**
 * Get year-to-date summary.
 * Wrapped with React.cache for request-level deduplication.
 */
export const getYearToDateSummary = cache(async function getYearToDateSummary(
  wineryId: string
): Promise<YearToDateSummary> {
  const now = new Date();
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  const bookings = await db.booking.findMany({
    where: {
      wineryId,
      date: { gte: yearStart, lte: yearEnd },
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
    },
    select: {
      totalPrice: true,
      platformFee: true,
      wineryPayout: true,
      refundIssued: true,
      refundAmount: true,
    },
  });

  const nonRefunded = bookings.filter((b) => !b.refundIssued);
  const refunded = bookings.filter((b) => b.refundIssued);

  return {
    grossRevenue: nonRefunded.reduce((sum, b) => sum + b.totalPrice, 0),
    platformFees: nonRefunded.reduce((sum, b) => sum + b.platformFee, 0),
    netEarnings: nonRefunded.reduce((sum, b) => sum + b.wineryPayout, 0),
    totalBookings: nonRefunded.length,
    refundedAmount: refunded.reduce((sum, b) => sum + (b.refundAmount || 0), 0),
  };
});

/**
 * GMV brought to the winery by EnCave (P-03 / L-044): totalPrice sum of
 * CONFIRMED + COMPLETED bookings, service fee excluded (platform revenue).
 * Wrapped with React.cache for request-level deduplication.
 */
export const getWineryGmv = cache(async function getWineryGmv(
  wineryId: string
): Promise<number> {
  const aggregate = await db.booking.aggregate({
    where: {
      wineryId,
      // NO_SHOW kept the money — it belongs in the GMV the platform
      // brought to the winery.
      status: {
        in: [
          BookingStatus.CONFIRMED,
          BookingStatus.COMPLETED,
          BookingStatus.NO_SHOW,
        ],
      },
    },
    _sum: { totalPrice: true },
  });

  return aggregate._sum.totalPrice ?? 0;
});

export interface MonthlyStatementLine {
  date: Date;
  reference: string;
  experienceTitle: string;
  guestCount: number;
  grossCents: number;
  commissionCents: number;
  netCents: number;
  refunded: boolean;
}

export interface MonthlyStatementData {
  /** 'YYYY-MM' */
  month: string;
  lines: MonthlyStatementLine[];
  /** Σ totalPrice before refunds (money-kept statuses). */
  grossCents: number;
  commissionCents: number;
  /** Client service fees — platform money, informative line only. */
  serviceFeesCents: number;
  /**
   * No-show fees the winery KEPT this month (P-08): Σ over charged, non-
   * reverted no-show bookings of (fee charged − tier commission). A reverted
   * (refunded) fee nets to 0 and is excluded. Added to the winery's net.
   */
  noShowFeesCents: number;
  /**
   * Refund impact on the winery's NET (payout × refunded fraction) —
   * NOT the client-facing refundAmount, which also contains the service
   * fee and commission parts. This keeps the identity
   * gross − commission − refunds = net exact on the PDF.
   */
  refundedCents: number;
  /** Σ wineryPayout net of full/partial refunds. */
  netCents: number;
}

/**
 * Monthly statement aggregate (P-13 / L-142). One row per booking whose
 * experience DATE falls in the month — the statement reads as "what the
 * month's activity earned you", matching the earnings screen. NO_SHOW is
 * included (the winery kept the money).
 */
export const getMonthlyStatementData = cache(
  async function getMonthlyStatementData(
    wineryId: string,
    month: string
  ): Promise<MonthlyStatementData | null> {
    if (!isMonthKey(month)) return null;
    const [yearStr, monthStr] = month.split('-');
    // UTC bounds: Booking.date is a UTC-midnight @db.Date — local-time
    // bounds would shift edge-of-month bookings on a non-UTC server.
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const monthStart = new Date(Date.UTC(year, monthIndex, 1));
    const nextMonthStart = new Date(Date.UTC(year, monthIndex + 1, 1));

    const bookings = await db.booking.findMany({
      where: {
        wineryId,
        date: { gte: monthStart, lt: nextMonthStart },
        status: {
          in: [
            BookingStatus.CONFIRMED,
            BookingStatus.COMPLETED,
            BookingStatus.NO_SHOW,
          ],
        },
      },
      orderBy: { date: 'asc' },
      select: {
        reference: true,
        date: true,
        guestCount: true,
        totalPrice: true,
        serviceFeeCents: true,
        platformFee: true,
        wineryPayout: true,
        refundIssued: true,
        refundAmount: true,
        noShowFeeChargeStatus: true,
        noShowFeeChargedCents: true,
        noShowFeeRefundId: true,
        experience: { select: { title: true } },
      },
    });

    const lines: MonthlyStatementLine[] = bookings.map((b) => ({
      date: b.date,
      reference: b.reference,
      experienceTitle: b.experience.title,
      guestCount: b.guestCount,
      grossCents: b.totalPrice,
      commissionCents: b.platformFee,
      netCents: Math.round(b.wineryPayout * (1 - refundedFraction(b))),
      refunded: b.refundIssued,
    }));

    // No-show fees kept: charged, not reverted. The winery receives the fee
    // net of its tier commission (destination charge, P-08 money routing).
    const winery = await db.winery.findUnique({
      where: { id: wineryId },
      select: { commissionRate: true },
    });
    const noShowRate = getEffectiveCommissionRate(
      { commissionRate: winery?.commissionRate ?? null },
      env.PLATFORM_COMMISSION_RATE
    );
    const noShowFeesCents = bookings.reduce((sum, b) => {
      if (
        b.noShowFeeChargeStatus !== NoShowChargeStatus.CHARGED ||
        b.noShowFeeRefundId
      ) {
        return sum;
      }
      const gross = b.noShowFeeChargedCents ?? 0;
      return sum + (gross - computeCommissionCents(gross, noShowRate));
    }, 0);

    return {
      month,
      lines,
      grossCents: bookings.reduce((sum, b) => sum + b.totalPrice, 0),
      commissionCents: bookings.reduce((sum, b) => sum + b.platformFee, 0),
      serviceFeesCents: bookings.reduce((sum, b) => sum + b.serviceFeeCents, 0),
      noShowFeesCents,
      refundedCents: bookings.reduce(
        (sum, b) => sum + Math.round(b.wineryPayout * refundedFraction(b)),
        0
      ),
      netCents:
        lines.reduce((sum, line) => sum + line.netCents, 0) + noShowFeesCents,
    };
  }
);
