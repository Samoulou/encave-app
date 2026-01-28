import { EarningsChartLazy } from '@/components/features/earnings/EarningsChartLazy';
import { getMonthlyEarnings } from '@/server/queries/earnings.queries';

interface EarningsChartsSectionProps {
  wineryId: string;
}

/**
 * Async server component for earnings chart.
 * Fetches monthly earnings for the Revenue Evolution chart.
 * Uses lazy-loaded chart component to defer recharts (~200KB) until render.
 */
export async function EarningsChartsSection({ wineryId }: EarningsChartsSectionProps) {
  const monthlyEarnings = await getMonthlyEarnings(wineryId, 6);

  return <EarningsChartLazy data={monthlyEarnings} />;
}
