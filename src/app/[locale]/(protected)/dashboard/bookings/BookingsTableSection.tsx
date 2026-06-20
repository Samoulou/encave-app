import { BookingStatus } from '@prisma/client';
import { startOfMonth, parseISO } from 'date-fns';
import { BookingsTable } from '@/components/features/booking/dashboard/BookingsTable';
import { BookingsEmptyState } from '@/components/features/booking/dashboard/BookingsEmptyState';
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
import { getTranslations } from 'next-intl/server';

const DEFAULT_BOOKING_DATE_TO = new Date(Date.UTC(9999, 11, 31));

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
export async function BookingsTableSection({
  wineryId,
  params,
}: BookingsTableSectionProps) {
  const t = await getTranslations('bookings');
  // Parse filters from URL params
  const filters: BookingFiltersType = {};
  const hasExplicitDateFilter = Boolean(params.from || params.to);

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

  if (!hasExplicitDateFilter) {
    filters.dateFrom = localDateToUTC(new Date());
    filters.dateTo = DEFAULT_BOOKING_DATE_TO;
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
  const statusFilter =
    filters.status && filters.status.length > 0 ? filters.status : undefined;

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
          <div className="rounded-xl border border-border bg-white p-8 text-center">
            <p className="text-[#915564]">{t('filters.noResults')}</p>
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

function localDateToUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
}
