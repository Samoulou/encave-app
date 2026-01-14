import {
  BookingFilters,
  BookingSearch,
  ExportCSVButton,
} from '@/components/features/booking/dashboard';
import { getWineryExperiencesForFilter } from '@/server/queries/booking.queries';
import { CalendarViewWrapper } from './CalendarViewWrapper';

interface BookingsFiltersSectionProps {
  wineryId: string;
}

/**
 * Async server component for booking filters.
 * Fetches experience options for the filter dropdown.
 * Designed to stream independently from the table.
 */
export async function BookingsFiltersSection({ wineryId }: BookingsFiltersSectionProps) {
  const experiences = await getWineryExperiencesForFilter(wineryId);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <BookingFilters experiences={experiences} />
      <div className="flex items-center gap-3">
        <BookingSearch />
        <ExportCSVButton />
        <CalendarViewWrapper viewToggleOnly />
      </div>
    </div>
  );
}
