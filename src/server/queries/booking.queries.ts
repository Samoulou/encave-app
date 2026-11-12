import { cache } from 'react';
import { db } from '@/server/db';
import { BookingStatus, Prisma } from '@prisma/client';
import { HOLD_EMAIL_DOMAIN } from '@/lib/constants/booking-hold';
import { addDays } from 'date-fns';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';

export interface BookingFilters {
  status?: BookingStatus[];
  experienceId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface BookingSortOptions {
  field: 'date' | 'totalPrice' | 'guestCount';
  direction: 'asc' | 'desc';
}

export interface BookingWithExperience {
  id: string;
  reference: string;
  visitorEmail: string;
  visitorName: string;
  visitorPhone: string;
  date: Date;
  timeSlot: string;
  guestCount: number;
  totalPrice: number;
  wineryPayout: number;
  status: BookingStatus;
  cancelledAt: Date | null;
  refundIssued: boolean;
  refundAmount: number | null;
  createdAt: Date;
  experience: {
    id: string;
    title: string;
    slug: string;
  };
}

export interface BookingSummary {
  todayCount: number;
  todayGuests: number;
  weekCount: number;
  weekGuests: number;
  monthCount: number;
  monthGuests: number;
  totalGuests: number;
}

export interface ExperienceOption {
  id: string;
  title: string;
}

/** Rows per page of the winery bookings list (server-side pagination). */
export const WINERY_BOOKINGS_PAGE_SIZE = 10;

const wineryBookingSelect = {
  id: true,
  reference: true,
  visitorEmail: true,
  visitorName: true,
  visitorPhone: true,
  date: true,
  timeSlot: true,
  guestCount: true,
  totalPrice: true,
  wineryPayout: true,
  status: true,
  cancelledAt: true,
  refundIssued: true,
  refundAmount: true,
  createdAt: true,
  experience: {
    select: {
      id: true,
      title: true,
      slug: true,
    },
  },
} satisfies Prisma.BookingSelect;

function buildWineryBookingsWhere(
  wineryId: string,
  filters?: BookingFilters
): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {
    wineryId,
    // Unclaimed slot holds (P-04 / L-050) are internal capacity rows with
    // placeholder visitors — never a booking the winery should see,
    // approve, or export.
    NOT: { visitorEmail: { endsWith: `@${HOLD_EMAIL_DOMAIN}` } },
  };

  // Apply status filter
  if (filters?.status && filters.status.length > 0) {
    where.status = { in: filters.status };
  }

  // Apply experience filter
  if (filters?.experienceId) {
    where.experienceId = filters.experienceId;
  }

  // Apply date range filter
  if (filters?.dateFrom || filters?.dateTo) {
    where.date = {};
    if (filters.dateFrom) {
      where.date.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.date.lte = filters.dateTo;
    }
  }

  // Apply search filter (client name or reference)
  if (filters?.search) {
    const searchTerm = filters.search.trim();
    where.OR = [
      { visitorName: { contains: searchTerm, mode: 'insensitive' } },
      {
        reference: { contains: searchTerm.toUpperCase(), mode: 'insensitive' },
      },
    ];
  }

  return where;
}

function buildWineryBookingsOrderBy(
  sort?: BookingSortOptions
): Prisma.BookingOrderByWithRelationInput[] {
  const primary: Prisma.BookingOrderByWithRelationInput = {};
  if (sort) {
    primary[
      sort.field === 'totalPrice'
        ? 'totalPrice'
        : sort.field === 'guestCount'
          ? 'guestCount'
          : 'date'
    ] = sort.direction;
  } else {
    // Default: upcoming first (date asc), but show past at bottom
    primary.date = 'asc';
  }
  // `id` is the final tie-break: without a total order, two rows sharing
  // (sort key, timeSlot) could swap between pages of the paginated list.
  return [primary, { timeSlot: 'asc' }, { id: 'asc' }];
}

/**
 * ALL bookings of a winery matching the filters — the CSV export path.
 * Unbounded on purpose (the export is the full filtered set): never feed
 * this to a rendered list, use {@link getWineryBookingsPage}.
 * Wrapped with React.cache for request-level deduplication.
 */
export const getWineryBookings = cache(async function getWineryBookings(
  wineryId: string,
  filters?: BookingFilters,
  sort?: BookingSortOptions
): Promise<BookingWithExperience[]> {
  return db.booking.findMany({
    where: buildWineryBookingsWhere(wineryId, filters),
    orderBy: buildWineryBookingsOrderBy(sort),
    select: wineryBookingSelect,
  });
});

export interface WineryBookingsPage {
  bookings: BookingWithExperience[];
  /** Rows matching the filters, across all pages. */
  total: number;
  /** 1-based page actually returned (clamped to the last page). */
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * One page of a winery's bookings (dashboard list). The page is sliced in
 * SQL (`skip`/`take`) next to a `count` of the same predicate — the list
 * used to ship every booking (emails and phones included) to the browser,
 * which then displayed five of them.
 *
 * A page past the end (stale URL, a filter that shrank the result) is
 * clamped to the last page rather than rendered empty.
 */
export const getWineryBookingsPage = cache(async function getWineryBookingsPage(
  wineryId: string,
  filters?: BookingFilters,
  sort?: BookingSortOptions,
  pagination?: { page?: number; pageSize?: number }
): Promise<WineryBookingsPage> {
  const pageSize = Math.min(
    100,
    Math.max(1, Math.trunc(pagination?.pageSize ?? WINERY_BOOKINGS_PAGE_SIZE))
  );
  const requestedPage = Math.max(1, Math.trunc(pagination?.page ?? 1) || 1);
  const where = buildWineryBookingsWhere(wineryId, filters);
  const orderBy = buildWineryBookingsOrderBy(sort);

  const fetchPage = (page: number) =>
    db.booking.findMany({
      where,
      orderBy,
      select: wineryBookingSelect,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

  const [rows, total] = await Promise.all([
    fetchPage(requestedPage),
    db.booking.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const bookings =
    page !== requestedPage && total > 0 ? await fetchPage(page) : rows;

  return { bookings, total, page, pageSize, totalPages };
});

/**
 * Get summary statistics for dashboard cards.
 * Wrapped with React.cache for request-level deduplication.
 */
export const getBookingSummary = cache(async function getBookingSummary(
  wineryId: string
): Promise<BookingSummary> {
  const now = new Date();

  // P-13 (A4): "today" = the Europe/Zurich calendar day (UTC midnight),
  // the SAME reference as the occurrence engine — the Aujourd'hui KPIs
  // and the calendar can no longer drift a day apart with the server tz.
  const todayUTC = zurichTodayAsUTCDate(now);
  const tomorrowUTC = addDays(todayUTC, 1);

  // Rolling upcoming window: today through the next 7 calendar days.
  const upcomingWindowEndUTC = addDays(todayUTC, 8);

  // Month boundaries (Zurich calendar month, UTC-midnight bounds)
  const monthStartUTC = new Date(
    Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1)
  );
  const monthEndUTC = new Date(
    Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() + 1, 1)
  );

  // Active statuses for counting (exclude pending payment and cancelled)
  const activeStatuses = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

  const [todayStats, weekStats, monthStats, totalStats] = await Promise.all([
    // Today's bookings - use exact date match via gte/lt pattern
    db.booking.aggregate({
      where: {
        wineryId,
        date: { gte: todayUTC, lt: tomorrowUTC },
        status: { in: activeStatuses },
      },
      _count: true,
      _sum: { guestCount: true },
    }),
    // Upcoming bookings for the next 7 days
    db.booking.aggregate({
      where: {
        wineryId,
        date: { gte: todayUTC, lt: upcomingWindowEndUTC },
        status: { in: activeStatuses },
      },
      _count: true,
      _sum: { guestCount: true },
    }),
    // This month's bookings
    db.booking.aggregate({
      where: {
        wineryId,
        date: { gte: monthStartUTC, lt: monthEndUTC },
        status: { in: activeStatuses },
      },
      _count: true,
      _sum: { guestCount: true },
    }),
    // All-time total guests
    db.booking.aggregate({
      where: {
        wineryId,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      },
      _sum: { guestCount: true },
    }),
  ]);

  return {
    todayCount: todayStats._count,
    todayGuests: todayStats._sum.guestCount ?? 0,
    weekCount: weekStats._count,
    weekGuests: weekStats._sum.guestCount ?? 0,
    monthCount: monthStats._count,
    monthGuests: monthStats._sum.guestCount ?? 0,
    totalGuests: totalStats._sum.guestCount ?? 0,
  };
});

/**
 * Get distinct experiences for filter dropdown.
 * Wrapped with React.cache for request-level deduplication.
 */
export const getWineryExperiencesForFilter = cache(
  async function getWineryExperiencesForFilter(
    wineryId: string
  ): Promise<ExperienceOption[]> {
    // `isCustom: false` drops the P-10 sur-mesure holder from the filter
    // dropdown (a stray entry for the wineries that never use it); those
    // bookings still appear in the unfiltered list.
    const experiences = await db.experience.findMany({
      where: { wineryId, isCustom: false },
      select: {
        id: true,
        title: true,
      },
      orderBy: { title: 'asc' },
    });

    return experiences;
  }
);
