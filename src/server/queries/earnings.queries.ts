import { cache } from 'react';
import { db } from '@/server/db';
import { env } from '@/lib/env';
import { isMonthKey } from '@/lib/utils/date-key';
import {
  computeCommissionCents,
  getEffectiveCommissionRate,
} from '@/lib/business-rules/commission';
import { computeBookingEarnings } from '@/lib/business-rules/earnings';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/i18n/routing';
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

/**
 * Labels are produced through the i18n formatters. Callers that know the
 * request locale pass it; the earnings client components re-derive their
 * own label from the month KEY with `useLocale()`, so a caller that does
 * not pass one still renders in the visitor's language.
 */
const DEFAULT_LABEL_LOCALE: Locale = 'fr';

export interface EarningsSummary {
  totalEarnings: number;
  thisMonth: number;
  lastMonth: number;
  yearToDate: number;
  /** 'yyyy-MM' — locale-neutral key of the current month. */
  currentMonth: string;
  /** Localized short month name (formatters) in the query's locale. */
  currentMonthLabel: string;
}

export interface MonthlyEarning {
  /** 'yyyy-MM' — locale-neutral key. */
  month: string;
  /** Localized short month name (formatters) in the query's locale. */
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
 * The money rule lives in ONE pure module (business-rules/earnings.ts) and
 * every figure below goes through `computeBookingEarnings`, so the summary
 * cards, the chart, the transactions list, the yearly export and the
 * monthly statement can never disagree on what a booking earned.
 */
const EARNINGS_FACTS_SELECT = {
  status: true,
  totalPrice: true,
  serviceFeeCents: true,
  platformFee: true,
  wineryPayout: true,
  refundAmount: true,
  refundIssued: true,
  stripePaymentIntentId: true,
  giftAppliedCents: true,
  giftTransferId: true,
} satisfies Prisma.BookingSelect;

const ACTIVE_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
];

/**
 * Every booking that MAY carry earnings or volume: the ones that took (or
 * will take) place — NO_SHOW included, identically everywhere — plus client
 * cancellations with a real money movement, where the winery may have kept
 * part of the payout. `computeBookingEarnings` has the final word.
 */
function earningsCandidatesWhere(wineryId: string): Prisma.BookingWhereInput {
  return {
    wineryId,
    OR: [
      { status: { in: ACTIVE_STATUSES } },
      {
        status: BookingStatus.CANCELLED_BY_CLIENT,
        OR: [
          { stripePaymentIntentId: { not: null } },
          { giftTransferId: { not: null } },
        ],
      },
    ],
  };
}

/** Localized short month name ("janv.", "Jan.", "Jan") via the formatters. */
function shortMonthLabel(date: Date, locale: Locale): string {
  return formatDate(date, locale, {
    month: 'short',
    day: undefined,
    year: undefined,
  });
}

/**
 * Get earnings summary for dashboard cards.
 * Wrapped with React.cache for request-level deduplication.
 *
 * Two bounded reads instead of loading every booking the winery ever had:
 *  1. a DB aggregation (GROUP BY date) over the overwhelming majority —
 *     bookings that took place, paid online, never refunded: for those the
 *     net IS `wineryPayout` and the gross IS `totalPrice`, so Postgres sums
 *     them and returns one row per day;
 *  2. the minority that needs the per-booking rule (any refund, or a client
 *     cancellation that may have left money with the winery), computed in
 *     JS with the very same function the statement uses.
 * The two sets are disjoint and together equal the full rule.
 */
export const getEarningsSummary = cache(async function getEarningsSummary(
  wineryId: string,
  locale: Locale = DEFAULT_LABEL_LOCALE
): Promise<EarningsSummary> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const yearStart = startOfYear(now);

  const [plainByDate, adjusted] = await Promise.all([
    db.booking.groupBy({
      by: ['date'],
      where: {
        wineryId,
        // Only experiences already held count as earned.
        date: { lte: now },
        status: { in: ACTIVE_STATUSES },
        refundIssued: false,
        AND: [
          { OR: [{ refundAmount: null }, { refundAmount: { lte: 0 } }] },
          // A real online money movement (never ON_SITE).
          {
            OR: [
              { stripePaymentIntentId: { not: null } },
              { giftAppliedCents: { gt: 0 } },
            ],
          },
        ],
      },
      _sum: { wineryPayout: true, totalPrice: true },
    }),
    db.booking.findMany({
      where: {
        AND: [
          earningsCandidatesWhere(wineryId),
          { date: { lte: now } },
          {
            OR: [
              { refundIssued: true },
              { refundAmount: { gt: 0 } },
              { status: BookingStatus.CANCELLED_BY_CLIENT },
            ],
          },
        ],
      },
      select: { date: true, ...EARNINGS_FACTS_SELECT },
    }),
  ]);

  let totalEarnings = 0;
  let thisMonth = 0;
  let lastMonth = 0;
  let yearToDate = 0;
  const add = (date: Date, netCents: number, grossKeptCents: number) => {
    totalEarnings += netCents;
    if (date >= monthStart && date <= monthEnd) thisMonth += netCents;
    if (date >= lastMonthStart && date <= lastMonthEnd) lastMonth += netCents;
    // Year to date is GROSS revenue (tickets), net of refunds.
    if (date >= yearStart) yearToDate += grossKeptCents;
  };
  for (const day of plainByDate) {
    add(day.date, day._sum.wineryPayout ?? 0, day._sum.totalPrice ?? 0);
  }
  for (const booking of adjusted) {
    const earnings = computeBookingEarnings(booking);
    if (!earnings.online) continue;
    add(booking.date, earnings.netCents, earnings.grossKeptCents);
  }

  return {
    totalEarnings,
    thisMonth,
    lastMonth,
    yearToDate,
    currentMonth: format(now, 'yyyy-MM'),
    currentMonthLabel: shortMonthLabel(now, locale),
  };
});

/**
 * Get monthly earnings for chart (last N months).
 * Wrapped with React.cache for request-level deduplication.
 */
export const getMonthlyEarnings = cache(async function getMonthlyEarnings(
  wineryId: string,
  months: number = 6,
  locale: Locale = DEFAULT_LABEL_LOCALE
): Promise<MonthlyEarning[]> {
  const now = new Date();

  // P-16 (WS-F / L-208): ONE query over the whole window, bucketed in JS —
  // the old shape ran N sequential findMany (one per month).
  const windowStart = startOfMonth(subMonths(now, months - 1));
  const windowEnd = endOfMonth(now);
  const bookings = await db.booking.findMany({
    where: {
      AND: [
        earningsCandidatesWhere(wineryId),
        { date: { gte: windowStart, lte: windowEnd } },
      ],
    },
    select: { date: true, ...EARNINGS_FACTS_SELECT },
  });

  const byMonth = new Map<
    string,
    { revenue: number; payout: number; bookingCount: number }
  >();
  for (const booking of bookings) {
    const earnings = computeBookingEarnings(booking);
    if (!earnings.listed) continue;
    const key = format(booking.date, 'yyyy-MM');
    const bucket = byMonth.get(key) ?? {
      revenue: 0,
      payout: 0,
      bookingCount: 0,
    };
    // Money: online bookings only, net of refunds. Volume: every booking
    // that took place, ON_SITE included.
    bucket.revenue += earnings.grossKeptCents;
    bucket.payout += earnings.netCents;
    if (earnings.countsAsBooking) bucket.bookingCount += 1;
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
      monthLabel: shortMonthLabel(targetMonth, locale),
      ...bucket,
    });
  }

  return results;
});

/**
 * Get transactions with filters.
 * Wrapped with React.cache for request-level deduplication.
 *
 * A MONEY ledger: one row per booking with a real online money movement,
 * amounts net of refunds. ON_SITE bookings moved no money through the
 * platform and are not listed here (they are volume: chart count, yearly
 * total, monthly statement).
 */
export const getTransactions = cache(async function getTransactions(
  wineryId: string,
  filters?: TransactionFilters
): Promise<Transaction[]> {
  const conditions: Prisma.BookingWhereInput[] = [
    earningsCandidatesWhere(wineryId),
  ];

  // Month filter
  if (filters?.month) {
    const parts = filters.month.split('-').map(Number);
    const year = parts[0] ?? new Date().getFullYear();
    const month = parts[1] ?? 1;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = endOfMonth(monthStart);
    conditions.push({ date: { gte: monthStart, lte: monthEnd } });
  }

  // Experience filter
  if (filters?.experienceId) {
    conditions.push({ experienceId: filters.experienceId });
  }

  const bookings = await db.booking.findMany({
    where: { AND: conditions },
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
      visitorName: true,
      ...EARNINGS_FACTS_SELECT,
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
  let transactions: Transaction[] = [];
  for (const b of bookings) {
    const earnings = computeBookingEarnings(b);
    if (!earnings.listed || !earnings.online) continue;
    const status: TransactionStatus = earnings.refunded
      ? 'refunded'
      : earnings.countsAsBooking && b.date > now
        ? 'upcoming'
        : 'completed';

    transactions.push({
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
      grossAmount: earnings.grossCents,
      platformFee: earnings.commissionCents,
      netPayout: earnings.netCents,
      status,
      reference: b.reference,
    });
  }

  // Status filter (applied after calculation)
  if (filters?.status) {
    transactions = transactions.filter((t) => t.status === filters.status);
  }

  return transactions;
});

/**
 * Get year-to-date summary.
 * Wrapped with React.cache for request-level deduplication.
 * Identity: grossRevenue − platformFees − refundedAmount = netEarnings.
 */
export const getYearToDateSummary = cache(async function getYearToDateSummary(
  wineryId: string
): Promise<YearToDateSummary> {
  const now = new Date();
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  const bookings = await db.booking.findMany({
    where: {
      AND: [
        earningsCandidatesWhere(wineryId),
        { date: { gte: yearStart, lte: yearEnd } },
      ],
    },
    select: EARNINGS_FACTS_SELECT,
  });

  const summary: YearToDateSummary = {
    grossRevenue: 0,
    platformFees: 0,
    netEarnings: 0,
    totalBookings: 0,
    refundedAmount: 0,
  };
  for (const booking of bookings) {
    const earnings = computeBookingEarnings(booking);
    if (!earnings.listed) continue;
    summary.grossRevenue += earnings.grossCents;
    summary.platformFees += earnings.commissionCents;
    summary.netEarnings += earnings.netCents;
    summary.refundedAmount += earnings.refundedCents;
    if (earnings.countsAsBooking) summary.totalBookings += 1;
  }
  return summary;
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
  /**
   * Settled at the winery (ON_SITE / free): listed as volume, no money
   * went through EnCave — gross, commission and net are all 0.
   */
  onSite: boolean;
  /** Cancelled by the client, money kept per the cancellation policy. */
  cancelled: boolean;
}

export interface MonthlyStatementData {
  /** 'YYYY-MM' */
  month: string;
  lines: MonthlyStatementLine[];
  /** Σ tickets sold ONLINE, before refunds (ON_SITE excluded). */
  grossCents: number;
  /** Σ commission actually kept (refunded pro rata with the tickets). */
  commissionCents: number;
  /** Client service fees kept — platform money, informative line only. */
  serviceFeesCents: number;
  /**
   * No-show fees the winery KEPT this month (P-08): Σ over charged, non-
   * reverted no-show bookings of (fee charged − tier commission). A reverted
   * (refunded) fee nets to 0 and is excluded. Added to the winery's net.
   */
  noShowFeesCents: number;
  /**
   * Ticket money returned to clients (the service-fee part of a refund is
   * platform money and is not in here). Derived per booking so the
   * identity gross − commission − refunds = net (before no-show fees) is
   * exact on the PDF.
   */
  refundedCents: number;
  /** Σ wineryPayout net of full/partial refunds, plus no-show fees kept. */
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
        AND: [
          earningsCandidatesWhere(wineryId),
          { date: { gte: monthStart, lt: nextMonthStart } },
        ],
      },
      orderBy: { date: 'asc' },
      select: {
        reference: true,
        date: true,
        guestCount: true,
        ...EARNINGS_FACTS_SELECT,
        noShowFeeChargeStatus: true,
        noShowFeeChargedCents: true,
        noShowFeeRefundId: true,
        experience: { select: { title: true } },
      },
    });

    const lines: MonthlyStatementLine[] = [];
    let grossCents = 0;
    let commissionCents = 0;
    let serviceFeesCents = 0;
    let refundedCents = 0;
    let bookingsNetCents = 0;
    for (const b of bookings) {
      const earnings = computeBookingEarnings(b);
      if (!earnings.listed) continue;
      lines.push({
        date: b.date,
        reference: b.reference,
        experienceTitle: b.experience.title,
        guestCount: b.guestCount,
        grossCents: earnings.grossCents,
        commissionCents: earnings.commissionCents,
        netCents: earnings.netCents,
        refunded: earnings.refunded,
        onSite: !earnings.online,
        cancelled: b.status === BookingStatus.CANCELLED_BY_CLIENT,
      });
      grossCents += earnings.grossCents;
      commissionCents += earnings.commissionCents;
      refundedCents += earnings.refundedCents;
      bookingsNetCents += earnings.netCents;
      if (earnings.online && earnings.grossCents > 0) {
        // The fee is refunded in the same proportion as the tickets.
        serviceFeesCents += Math.round(
          (b.serviceFeeCents * earnings.grossKeptCents) / earnings.grossCents
        );
      } else if (earnings.online) {
        serviceFeesCents += b.serviceFeeCents;
      }
    }

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
      grossCents,
      commissionCents,
      serviceFeesCents,
      noShowFeesCents,
      refundedCents,
      netCents: bookingsNetCents + noShowFeesCents,
    };
  }
);
