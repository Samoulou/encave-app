import { BookingFilters } from '@/components/features/booking/dashboard/BookingFilters';
import { BookingSearch } from '@/components/features/booking/dashboard/BookingSearch';
import { getWineryExperiencesForFilter } from '@/server/queries/booking.queries';
import { CalendarViewWrapper } from './CalendarViewWrapper';

interface BookingsFiltersSectionProps {
  wineryId: string;
}

/**
 * Async server component for booking filters toolbar.
 * Fetches experience options for the filter dropdown.
 * Designed to stream independently from the table.
 * Layout: Search | Filter Button | View Toggle (List/Calendar)
 */
export async function BookingsFiltersSection({
  wineryId,
}: BookingsFiltersSectionProps) {
  const experiences = await getWineryExperiencesForFilter(wineryId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-white p-2">
      <div className="flex min-w-[300px] flex-1 items-center gap-2">
        <BookingSearch />
        <BookingFilters experiences={experiences} />
      </div>
      <CalendarViewWrapper viewToggleOnly />
    </div>
  );
}
