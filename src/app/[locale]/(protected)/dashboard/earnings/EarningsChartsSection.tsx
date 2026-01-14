import {
  EarningsChart,
  YearToDateSummary,
} from '@/components/features/earnings';
import {
  getMonthlyEarnings,
  getYearToDateSummary,
} from '@/server/queries/earnings.queries';

interface EarningsChartsSectionProps {
  wineryId: string;
}

/**
 * Async server component for earnings charts.
 * Fetches monthly earnings and YTD summary in parallel.
 */
export async function EarningsChartsSection({ wineryId }: EarningsChartsSectionProps) {
  const [monthlyEarnings, ytdSummary] = await Promise.all([
    getMonthlyEarnings(wineryId, 6),
    getYearToDateSummary(wineryId),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <EarningsChart data={monthlyEarnings} />
      <YearToDateSummary summary={ytdSummary} />
    </div>
  );
}
