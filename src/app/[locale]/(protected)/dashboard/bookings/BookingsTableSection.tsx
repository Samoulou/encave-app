import { BookingStatus } from '@prisma/client';
import { startOfMonth, parseISO } from 'date-fns';
import {
  BookingsTable,
  BookingsEmptyState,
} from '@/components/features/booking/dashboard';
import {
  getWineryBookings,
  getBookingSummary,
  type BookingFilters as BookingFiltersType,
  type BookingSortOptions,
} from '@/server/queries/booking.queries';
import {
  getMonthCalendarData,
  getWeekCalendarData,
} from '@/server/queries/calendar.queries';
import { CalendarViewWrapper } from './CalendarViewWrapper';

interface BookingsTableSectionProps {
  wineryId: string;
  params: {
    status?: string;
    experience?: string;
    from?: string;
    to?: string;
    search?: string;
    sort?: string;
    order?: string;
    view?: string;
    month?: string;
  };
}

/**
 * Async server component for booking table/calendar content.
 * This is the heaviest query, designed to stream after summary and filters.
 */
export async function BookingsTableSection({ wineryId, params }: BookingsTableSectionProps) {
  // Parse filters from URL params
  const filters: BookingFiltersType = {};

  if (params.status) {
    filters.status = params.status.split(',') as BookingStatus[];
  }

  if (params.experience) {
    filters.experienceId = params.experience;
  }

  if (params.from) {
    filters.dateFrom = new Date(params.from);
  }

  if (params.to) {
    filters.dateTo = new Date(params.to);
  }

  if (params.search) {
    filters.search = params.search;
  }

  // Parse sort options
  const sort: BookingSortOptions | undefined =
    params.sort && ['date', 'totalPrice', 'guestCount'].includes(params.sort)
      ? {
          field: params.sort as 'date' | 'totalPrice' | 'guestCount',
          direction: params.order === 'desc' ? 'desc' : 'asc',
        }
      : undefined;

  // Parse view mode and calendar date
  const viewMode = (params.view as 'list' | 'calendar' | 'week') || 'list';
  const calendarDate = params.month
    ? startOfMonth(parseISO(`${params.month}-01`))
    : new Date();

  // Status filter for calendar
  const statusFilter = filters.status && filters.status.length > 0
    ? filters.status
    : undefined;

  // Fetch bookings and calendar data in parallel
  const [bookings, summary, calendarData] = await Promise.all([
    getWineryBookings(wineryId, filters, sort),
    getBookingSummary(wineryId),
    viewMode === 'calendar'
      ? getMonthCalendarData(wineryId, calendarDate, statusFilter)
      : viewMode === 'week'
        ? getWeekCalendarData(wineryId, calendarDate, statusFilter)
        : Promise.resolve(new Map()),
  ]);

  const hasAnyBookings = summary.totalGuests > 0 || bookings.length > 0;

  if (!hasAnyBookings) {
    return <BookingsEmptyState />;
  }

  return (
    <>
      {viewMode === 'list' ? (
        bookings.length > 0 ? (
          <BookingsTable bookings={bookings} />
        ) : (
          <div className="bg-white rounded-xl border border-[#e5d2d7] p-8 text-center">
            <p className="text-[#915564]">
              No bookings match your current filters.
            </p>
          </div>
        )
      ) : (
        <CalendarViewWrapper
          viewMode={viewMode}
          calendarData={calendarData}
          initialDate={calendarDate}
        />
      )}
    </>
  );
}
