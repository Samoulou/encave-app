'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/shared/Skeleton';
import type { MonthlyEarning } from '@/server/queries/earnings.queries';

// bundle-dynamic-imports: Defer recharts (~200KB) until actually needed
const EarningsChart = dynamic(
  () => import('./EarningsChart').then((mod) => ({ default: mod.EarningsChart })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-[#e5d2d7] bg-white p-6 lg:p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <Skeleton className="h-[320px] w-full" />
      </div>
    ),
  }
);

interface EarningsChartLazyProps {
  data: MonthlyEarning[];
}

/**
 * Lazy-loaded wrapper for EarningsChart.
 * Defers loading recharts until the component is rendered on the client.
 */
export function EarningsChartLazy({ data }: EarningsChartLazyProps) {
  return <EarningsChart data={data} />;
}
