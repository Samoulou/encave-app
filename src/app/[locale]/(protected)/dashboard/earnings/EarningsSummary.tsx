import { EarningsSummaryCards } from '@/components/features/earnings/EarningsSummaryCards';
import { getEarningsSummary } from '@/server/queries/earnings.queries';

interface EarningsSummaryProps {
  wineryId: string;
}

/**
 * Async server component for earnings summary cards.
 * Designed to stream first for fastest perceived loading.
 */
export async function EarningsSummary({ wineryId }: EarningsSummaryProps) {
  const summary = await getEarningsSummary(wineryId);

  return <EarningsSummaryCards summary={summary} />;
}
