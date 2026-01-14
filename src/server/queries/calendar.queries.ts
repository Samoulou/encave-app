import { db } from '@/server/db';
import { BookingStatus, ExperienceType } from '@prisma/client';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from 'date-fns';

/**
 * Convert a local date to UTC date, preserving the local date components.
 * This ensures that dates in local time map to the correct database date.
 */
function localDateToUTC(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Get the date string in YYYY-MM-DD format from a UTC date.
 * This is used for creating consistent map keys from database dates.
 */
function toUTCDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface CalendarBooking {
  id: string;
  reference: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  date: Date;
  timeSlot: string;
  guestCount: number;
  totalPrice: number;
  status: BookingStatus;
  experience: {
    id: string;
    title: string;
    slug: string;
    type: ExperienceType;
    duration: number;
  };
}

export interface CalendarDayData {
  date: string; // YYYY-MM-DD
  bookings: CalendarBooking[];
  bookingCount: number;
  totalGuests: number;
  experienceTypes: ExperienceType[];
  blockedExperienceIds: string[];
}

export interface BlockedDateInfo {
  id: string;
  experienceId: string;
  experienceTitle: string;
  date: Date;
  reason: string | null;
}

/**
 * Get calendar data for a winery within a date range
 * Returns bookings grouped by date
 */
export async function getCalendarData(
  wineryId: string,
  startDate: Date,
  endDate: Date,
  statusFilter?: BookingStatus[]
): Promise<Map<string, CalendarDayData>> {
  // Default to showing confirmed and completed bookings
  const statuses = statusFilter && statusFilter.length > 0
    ? statusFilter
    : [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

  // Normalize dates to UTC for consistent database comparison
  // Use lt instead of lte for endDate to include the full end day
  const startUTC = localDateToUTC(startDate);
  const endUTC = localDateToUTC(addDays(endDate, 1)); // Day after to include full end day

  const bookings = await db.booking.findMany({
    where: {
      wineryId,
      date: { gte: startUTC, lt: endUTC },
      status: { in: statuses },
    },
    orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
    select: {
      id: true,
      reference: true,
      visitorName: true,
      visitorEmail: true,
      visitorPhone: true,
      date: true,
      timeSlot: true,
      guestCount: true,
      totalPrice: true,
      status: true,
      experience: {
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          duration: true,
        },
      },
    },
  });

  // Get blocked dates for the range
  const blockedDates = await db.blockedDate.findMany({
    where: {
      experience: { wineryId },
      date: { gte: startUTC, lt: endUTC },
    },
    select: {
      date: true,
      experienceId: true,
    },
  });

  // Group blocked dates by date string (UTC-based for consistency)
  const blockedByDate = new Map<string, string[]>();
  for (const blocked of blockedDates) {
    const dateKey = toUTCDateString(blocked.date);
    const existing = blockedByDate.get(dateKey) || [];
    existing.push(blocked.experienceId);
    blockedByDate.set(dateKey, existing);
  }

  // Group bookings by date
  const calendarData = new Map<string, CalendarDayData>();

  for (const booking of bookings) {
    // Use UTC-based date string for consistent key matching
    const dateKey = toUTCDateString(booking.date);

    let dayData = calendarData.get(dateKey);
    if (!dayData) {
      dayData = {
        date: dateKey,
        bookings: [],
        bookingCount: 0,
        totalGuests: 0,
        experienceTypes: [],
        blockedExperienceIds: blockedByDate.get(dateKey) || [],
      };
      calendarData.set(dateKey, dayData);
    }

    dayData.bookings.push(booking);
    dayData.bookingCount++;
    dayData.totalGuests += booking.guestCount;

    // Add experience type if not already present
    if (!dayData.experienceTypes.includes(booking.experience.type)) {
      dayData.experienceTypes.push(booking.experience.type);
    }
  }

  // Add entries for dates with only blocked dates (no bookings)
  blockedByDate.forEach((expIds, dateKey) => {
    if (!calendarData.has(dateKey)) {
      calendarData.set(dateKey, {
        date: dateKey,
        bookings: [],
        bookingCount: 0,
        totalGuests: 0,
        experienceTypes: [],
        blockedExperienceIds: expIds,
      });
    }
  });

  return calendarData;
}

/**
 * Get calendar data for a specific month
 */
export async function getMonthCalendarData(
  wineryId: string,
  month: Date,
  statusFilter?: BookingStatus[]
): Promise<Map<string, CalendarDayData>> {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  return getCalendarData(wineryId, start, end, statusFilter);
}

/**
 * Get calendar data for a specific week
 */
export async function getWeekCalendarData(
  wineryId: string,
  weekDate: Date,
  statusFilter?: BookingStatus[]
): Promise<Map<string, CalendarDayData>> {
  const start = startOfWeek(weekDate, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(weekDate, { weekStartsOn: 1 });
  return getCalendarData(wineryId, start, end, statusFilter);
}

/**
 * Get blocked dates for a winery within a date range
 */
export async function getBlockedDates(
  wineryId: string,
  startDate: Date,
  endDate: Date
): Promise<BlockedDateInfo[]> {
  // Normalize dates to UTC for consistent database comparison
  const startUTC = localDateToUTC(startDate);
  const endUTC = localDateToUTC(addDays(endDate, 1)); // Day after to include full end day

  const blockedDates = await db.blockedDate.findMany({
    where: {
      experience: { wineryId },
      date: { gte: startUTC, lt: endUTC },
    },
    select: {
      id: true,
      experienceId: true,
      date: true,
      reason: true,
      experience: {
        select: { title: true },
      },
    },
    orderBy: { date: 'asc' },
  });

  return blockedDates.map((bd) => ({
    id: bd.id,
    experienceId: bd.experienceId,
    experienceTitle: bd.experience.title,
    date: bd.date,
    reason: bd.reason,
  }));
}

/**
 * Get experience types available for a winery (for legend/filter)
 */
export async function getWineryExperienceTypes(
  wineryId: string
): Promise<{ type: ExperienceType; count: number }[]> {
  const experiences = await db.experience.groupBy({
    by: ['type'],
    where: { wineryId },
    _count: true,
  });

  return experiences.map((e) => ({
    type: e.type,
    count: e._count,
  }));
}

/**
 * Get experiences for a winery (for blocking dates)
 */
export async function getWineryExperiencesForBlocking(
  wineryId: string
): Promise<{ id: string; title: string; type: ExperienceType }[]> {
  const experiences = await db.experience.findMany({
    where: { wineryId, status: 'PUBLISHED' },
    select: {
      id: true,
      title: true,
      type: true,
    },
    orderBy: { title: 'asc' },
  });

  return experiences;
}
