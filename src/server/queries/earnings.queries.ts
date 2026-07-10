import { cache } from 'react';
import { db } from '@/server/db';
import { BookingStatus, Prisma } from '@prisma/client';
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
  const results: MonthlyEarning[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const targetMonth = subMonths(now, i);
    const monthStart = startOfMonth(targetMonth);
    const monthEnd = endOfMonth(targetMonth);

    const bookings = await db.booking.findMany({
      where: {
        wineryId,
        date: { gte: monthStart, lte: monthEnd },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        refundIssued: false,
      },
      select: {
        totalPrice: true,
        wineryPayout: true,
      },
    });

    results.push({
      month: format(targetMonth, 'yyyy-MM'),
      monthLabel: format(targetMonth, 'MMM'),
      revenue: bookings.reduce((sum, b) => sum + b.totalPrice, 0),
      payout: bookings.reduce((sum, b) => sum + b.wineryPayout, 0),
      bookingCount: bookings.length,
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

/**
 * Get experiences for filter dropdown.
 * Wrapped with React.cache for request-level deduplication.
 */
export const getWineryExperiencesForEarnings = cache(
  async function getWineryExperiencesForEarnings(
    wineryId: string
  ): Promise<{ id: string; title: string }[]> {
    return db.experience.findMany({
      where: { wineryId },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });
  }
);
