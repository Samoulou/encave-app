import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import { BookingStatus } from '@prisma/client';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import {
  BookingSummaryCards,
  BookingFilters,
  BookingSearch,
  BookingsTable,
  BookingsEmptyState,
  ExportCSVButton,
} from '@/components/features/booking/dashboard';
import {
  getWineryBookings,
  getBookingSummary,
  getWineryExperiencesForFilter,
  type BookingFilters as BookingFiltersType,
  type BookingSortOptions,
} from '@/server/queries/booking.queries';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    experience?: string;
    from?: string;
    to?: string;
    search?: string;
    sort?: string;
    order?: string;
  }>;
}

export default async function BookingsDashboardPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;

  // Get winery for the user
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!winery) {
    redirect('/onboarding/winery');
  }

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

  // Fetch data in parallel
  const [bookings, summary, experiences] = await Promise.all([
    getWineryBookings(winery.id, filters, sort),
    getBookingSummary(winery.id),
    getWineryExperiencesForFilter(winery.id),
  ]);

  const hasAnyBookings = summary.totalGuests > 0 || bookings.length > 0;

  return (
    <WineryAccessGuard>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="font-display text-display-md text-slate-900">
            Bookings
          </h1>
          <p className="text-slate-600">
            Manage reservations and track your upcoming visits
          </p>
        </div>

        {/* Summary Cards */}
        <BookingSummaryCards summary={summary} />

        {/* Main Content */}
        {!hasAnyBookings ? (
          <BookingsEmptyState />
        ) : (
          <>
            {/* Filters and Search Row */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <BookingFilters experiences={experiences} />
              <div className="flex items-center gap-2">
                <BookingSearch />
                <ExportCSVButton />
              </div>
            </div>

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
                <p className="text-slate-600">
                  No bookings match your current filters.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </WineryAccessGuard>
  );
}
