import { EarningsChart } from '@/components/features/earnings/EarningsChart';
import { getMonthlyEarnings } from '@/server/queries/earnings.queries';

interface EarningsChartsSectionProps {
  wineryId: string;
}

/**
 * Async server component for earnings chart.
 * Fetches monthly earnings for the Revenue Evolution chart.
 */
export async function EarningsChartsSection({ wineryId }: EarningsChartsSectionProps) {
  const monthlyEarnings = await getMonthlyEarnings(wineryId, 6);

  return <EarningsChart data={monthlyEarnings} />;
}
