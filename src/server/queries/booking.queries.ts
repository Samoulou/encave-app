import { db } from '@/server/db';
import { BookingStatus, Prisma } from '@prisma/client';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

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
 * Get bookings for a winery with optional filters and sorting
 */
export async function getWineryBookings(
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
}

/**
 * Get summary statistics for dashboard cards
 */
export async function getBookingSummary(wineryId: string): Promise<BookingSummary> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Active statuses for counting (exclude pending payment and cancelled)
  const activeStatuses = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

  const [todayStats, weekStats, monthStats, totalStats] = await Promise.all([
    // Today's bookings
    db.booking.aggregate({
      where: {
        wineryId,
        date: { gte: todayStart, lte: todayEnd },
        status: { in: activeStatuses },
      },
      _count: true,
      _sum: { guestCount: true },
    }),
    // This week's bookings
    db.booking.aggregate({
      where: {
        wineryId,
        date: { gte: weekStart, lte: weekEnd },
        status: { in: activeStatuses },
      },
      _count: true,
      _sum: { guestCount: true },
    }),
    // This month's bookings
    db.booking.aggregate({
      where: {
        wineryId,
        date: { gte: monthStart, lte: monthEnd },
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
}

/**
 * Get distinct experiences for filter dropdown
 */
export async function getWineryExperiencesForFilter(
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
}

/**
 * Get booking history for a specific client with a winery
 */
export async function getClientHistoryWithWinery(
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
}

/**
 * Get a single booking with full details for the winery owner
 */
export async function getBookingForWinery(
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
}
