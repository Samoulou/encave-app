import { cache } from 'react';
import { db } from '@/server/db';
import { BookingStatus, Prisma } from '@prisma/client';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
} from 'date-fns';

/**
 * Convert a local date to UTC date, preserving the local date components.
 * This ensures that "today" in local time maps to the correct database date.
 * The database stores dates as @db.Date (date-only), so we need to
 * ensure our queries use UTC-normalized dates to avoid timezone issues.
 */
function localDateToUTC(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

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

/**
 * Get bookings for a winery with optional filters and sorting.
 * Wrapped with React.cache for request-level deduplication.
 */
export const getWineryBookings = cache(async function getWineryBookings(
  wineryId: string,
  filters?: BookingFilters,
  sort?: BookingSortOptions
): Promise<BookingWithExperience[]> {
  const where: Prisma.BookingWhereInput = {
    wineryId,
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
      { reference: { contains: searchTerm.toUpperCase(), mode: 'insensitive' } },
    ];
  }

  // Determine sort order
  const orderBy: Prisma.BookingOrderByWithRelationInput = {};
  if (sort) {
    orderBy[sort.field === 'totalPrice' ? 'totalPrice' : sort.field === 'guestCount' ? 'guestCount' : 'date'] = sort.direction;
  } else {
    // Default: upcoming first (date asc), but show past at bottom
    orderBy.date = 'asc';
  }

  const bookings = await db.booking.findMany({
    where,
    orderBy: [orderBy, { timeSlot: 'asc' }],
    select: {
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
    },
  });

  return bookings;
});

/**
 * Get summary statistics for dashboard cards.
 * Wrapped with React.cache for request-level deduplication.
 */
export const getBookingSummary = cache(async function getBookingSummary(wineryId: string): Promise<BookingSummary> {
  const now = new Date();

  // Use local-to-UTC conversion for database comparison
  // The database uses @db.Date which stores date-only values
  // We convert local dates to UTC to match database storage format
  const todayUTC = localDateToUTC(now);
  const tomorrowUTC = localDateToUTC(addDays(now, 1));

  // Week boundaries (Monday start)
  const weekStartLocal = startOfWeek(now, { weekStartsOn: 1 });
  const weekEndLocal = endOfWeek(now, { weekStartsOn: 1 });
  const weekStartUTC = localDateToUTC(weekStartLocal);
  const weekEndUTC = localDateToUTC(addDays(weekEndLocal, 1)); // Day after to include full end day

  // Month boundaries
  const monthStartLocal = startOfMonth(now);
  const monthEndLocal = endOfMonth(now);
  const monthStartUTC = localDateToUTC(monthStartLocal);
  const monthEndUTC = localDateToUTC(addDays(monthEndLocal, 1)); // Day after to include full end day

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
    // This week's bookings
    db.booking.aggregate({
      where: {
        wineryId,
        date: { gte: weekStartUTC, lt: weekEndUTC },
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
export const getWineryExperiencesForFilter = cache(async function getWineryExperiencesForFilter(
  wineryId: string
): Promise<ExperienceOption[]> {
  const experiences = await db.experience.findMany({
    where: { wineryId },
    select: {
      id: true,
      title: true,
    },
    orderBy: { title: 'asc' },
  });

  return experiences;
});

/**
 * Get booking history for a specific client with a winery.
 * Wrapped with React.cache for request-level deduplication.
 */
export const getClientHistoryWithWinery = cache(async function getClientHistoryWithWinery(
  wineryId: string,
  visitorEmail: string
): Promise<BookingWithExperience[]> {
  const bookings = await db.booking.findMany({
    where: {
      wineryId,
      visitorEmail: { equals: visitorEmail, mode: 'insensitive' },
    },
    orderBy: { date: 'desc' },
    select: {
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
    },
  });

  return bookings;
});

/**
 * Get a single booking with full details for the winery owner.
 * Wrapped with React.cache for request-level deduplication.
 */
export const getBookingForWinery = cache(async function getBookingForWinery(
  bookingId: string,
  wineryId: string
): Promise<BookingWithExperience | null> {
  const booking = await db.booking.findFirst({
    where: {
      id: bookingId,
      wineryId,
    },
    select: {
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
    },
  });

  return booking;
});
