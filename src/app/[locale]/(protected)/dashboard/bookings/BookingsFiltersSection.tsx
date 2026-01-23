import {
  BookingFilters,
  BookingSearch,
} from '@/components/features/booking/dashboard';
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
export async function BookingsFiltersSection({ wineryId }: BookingsFiltersSectionProps) {
  const experiences = await getWineryExperiencesForFilter(wineryId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-2 rounded-xl border border-[#e5d2d7]">
      <div className="flex items-center gap-2 flex-1 min-w-[300px]">
        <BookingSearch />
        <BookingFilters experiences={experiences} />
      </div>
      <CalendarViewWrapper viewToggleOnly />
    </div>
  );
}
