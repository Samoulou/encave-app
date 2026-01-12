import { db } from '@/server/db';
import { BookingStatus, Prisma } from '@prisma/client';
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  format,
  differenceInDays,
  addDays,
} from 'date-fns';

export type TransactionStatus = 'paid' | 'pending' | 'refunded';

export interface EarningsSummary {
  totalEarnings: number;
  thisMonth: number;
  pendingPayout: number;
  nextPayoutDate: Date | null;
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
  experienceTitle: string;
  experienceId: string;
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
 * Determine transaction status based on booking state
 */
function getTransactionStatus(
  bookingStatus: BookingStatus,
  bookingDate: Date,
  refundIssued: boolean
): TransactionStatus {
  if (refundIssued) return 'refunded';

  if (bookingStatus === BookingStatus.COMPLETED) {
    const daysSinceExperience = differenceInDays(new Date(), bookingDate);
    return daysSinceExperience >= 7 ? 'paid' : 'pending';
  }

  return 'pending';
}

/**
 * Get earnings summary for dashboard cards
 */
export async function getEarningsSummary(wineryId: string): Promise<EarningsSummary> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Get all completed/confirmed bookings
  const bookings = await db.booking.findMany({
    where: {
      wineryId,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
    },
    select: {
      wineryPayout: true,
      date: true,
      status: true,
      refundIssued: true,
    },
  });

  // Total earnings (all time, excluding refunded)
  const totalEarnings = bookings
    .filter((b) => !b.refundIssued)
    .reduce((sum, b) => sum + b.wineryPayout, 0);

  // This month earnings
  const thisMonth = bookings
    .filter(
      (b) =>
        !b.refundIssued &&
        b.date >= monthStart &&
        b.date <= monthEnd
    )
    .reduce((sum, b) => sum + b.wineryPayout, 0);

  // Pending payout: completed bookings within last 7 days
  const pendingBookings = bookings.filter(
    (b) =>
      !b.refundIssued &&
      b.status === BookingStatus.COMPLETED &&
      differenceInDays(now, b.date) < 7
  );

  const pendingPayout = pendingBookings.reduce((sum, b) => sum + b.wineryPayout, 0);

  // Next payout date: earliest pending booking + 7 days
  const sortedPending = pendingBookings.sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const nextPayoutDate = sortedPending[0]
    ? addDays(sortedPending[0].date, 7)
    : null;

  return {
    totalEarnings,
    thisMonth,
    pendingPayout,
    nextPayoutDate,
  };
}

/**
 * Get monthly earnings for chart (last N months)
 */
export async function getMonthlyEarnings(
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
}

/**
 * Get transactions with filters
 */
export async function getTransactions(
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
      experience: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  // Map to Transaction type with status calculation
  let transactions: Transaction[] = bookings.map((b) => ({
    id: b.id,
    date: b.date,
    experienceTitle: b.experience.title,
    experienceId: b.experience.id,
    guestCount: b.guestCount,
    grossAmount: b.totalPrice,
    platformFee: b.platformFee,
    netPayout: b.wineryPayout,
    status: getTransactionStatus(b.status, b.date, b.refundIssued),
    reference: b.reference,
  }));

  // Status filter (applied after calculation)
  if (filters?.status) {
    transactions = transactions.filter((t) => t.status === filters.status);
  }

  return transactions;
}

/**
 * Get year-to-date summary
 */
export async function getYearToDateSummary(wineryId: string): Promise<YearToDateSummary> {
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
}

/**
 * Get experiences for filter dropdown
 */
export async function getWineryExperiencesForEarnings(
  wineryId: string
): Promise<{ id: string; title: string }[]> {
  return db.experience.findMany({
    where: { wineryId },
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  });
}
