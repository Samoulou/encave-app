import { BookingStatus } from '@prisma/client';
import { startOfMonth, parseISO } from 'date-fns';
import { BookingSummaryCards } from '@/components/features/booking/dashboard/BookingSummaryCards';
import { BookingFilters } from '@/components/features/booking/dashboard/BookingFilters';
import { BookingSearch } from '@/components/features/booking/dashboard/BookingSearch';
import { BookingsTable } from '@/components/features/booking/dashboard/BookingsTable';
import { BookingsEmptyState } from '@/components/features/booking/dashboard/BookingsEmptyState';
import { ExportCSVButton } from '@/components/features/booking/dashboard/ExportCSVButton';
import {
  getWineryBookings,
  getBookingSummary,
  getWineryExperiencesForFilter,
  type BookingFilters as BookingFiltersType,
  type BookingSortOptions,
} from '@/server/queries/booking.queries';
import {
  getMonthCalendarData,
  getWeekCalendarData,
} from '@/server/queries/calendar.queries';
import { CalendarViewWrapper } from './CalendarViewWrapper';
import { getTranslations } from 'next-intl/server';

interface BookingsContentProps {
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
 * Async server component that fetches booking data.
 * Designed to be wrapped in Suspense for streaming/progressive loading.
 */
export async function BookingsContent({
  wineryId,
  params,
}: BookingsContentProps) {
  const t = await getTranslations('bookings');
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
  const statusFilter =
    filters.status && filters.status.length > 0 ? filters.status : undefined;

  // Fetch data in parallel
  const [bookings, summary, experiences, calendarData] = await Promise.all([
    getWineryBookings(wineryId, filters, sort),
    getBookingSummary(wineryId),
    getWineryExperiencesForFilter(wineryId),
    viewMode === 'calendar'
      ? getMonthCalendarData(wineryId, calendarDate, statusFilter)
      : viewMode === 'week'
        ? getWeekCalendarData(wineryId, calendarDate, statusFilter)
        : Promise.resolve(new Map()),
  ]);

  const hasAnyBookings = summary.totalGuests > 0 || bookings.length > 0;

  return (
    <>
      {/* Summary Cards */}
      <BookingSummaryCards summary={summary} />

      {/* Main Content */}
      {!hasAnyBookings ? (
        <BookingsEmptyState />
      ) : (
        <>
          {/* Filters, Search and View Toggle Row */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <BookingFilters experiences={experiences} />
            <div className="flex items-center gap-3">
              <BookingSearch />
              <ExportCSVButton />
              <CalendarViewWrapper viewToggleOnly />
            </div>
          </div>

          {/* View Content */}
          {viewMode === 'list' ? (
            <>
              {/* Results Info */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
                  {Object.keys(filters).length > 0 && ' (filtered)'}
                </p>
              </div>

              {/* Bookings Table */}
              {bookings.length > 0 ? (
                <BookingsTable bookings={bookings} />
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
                  <p className="text-slate-600">{t('filters.noResults')}</p>
                </div>
              )}
            </>
          ) : (
            <CalendarViewWrapper
              viewMode={viewMode}
              calendarData={calendarData}
              initialDate={calendarDate}
            />
          )}
        </>
      )}
    </>
  );
}
