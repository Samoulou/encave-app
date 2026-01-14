import { BookingSummaryCards } from '@/components/features/booking/dashboard';
import { getBookingSummary } from '@/server/queries/booking.queries';

interface BookingsSummaryProps {
  wineryId: string;
}

/**
 * Async server component for booking summary cards.
 * Designed to stream independently for faster perceived loading.
 */
export async function BookingsSummary({ wineryId }: BookingsSummaryProps) {
  const summary = await getBookingSummary(wineryId);

  return <BookingSummaryCards summary={summary} />;
}
