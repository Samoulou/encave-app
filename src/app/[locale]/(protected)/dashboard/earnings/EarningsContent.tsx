import { EarningsSummaryCards } from '@/components/features/earnings/EarningsSummaryCards';
import { EarningsChartLazy } from '@/components/features/earnings/EarningsChartLazy';
import { TransactionFilters } from '@/components/features/earnings/TransactionFilters';
import { TransactionTable } from '@/components/features/earnings/TransactionTable';
import { YearToDateSummary } from '@/components/features/earnings/YearToDateSummary';
import { PayoutScheduleInfo } from '@/components/features/earnings/PayoutScheduleInfo';
import {
  getEarningsSummary,
  getMonthlyEarnings,
  getTransactions,
  getYearToDateSummary,
  getWineryExperiencesForEarnings,
  type TransactionFilters as TransactionFiltersType,
  type TransactionStatus,
} from '@/server/queries/earnings.queries';

interface EarningsContentProps {
  wineryId: string;
  params: {
    month?: string;
    experience?: string;
    status?: string;
  };
}

/**
 * Async server component that fetches earnings data.
 * Designed to be wrapped in Suspense for streaming/progressive loading.
 */
export async function EarningsContent({
  wineryId,
  params,
}: EarningsContentProps) {
  // Parse filters from URL params
  const filters: TransactionFiltersType = {};

  if (params.month) {
    filters.month = params.month;
  }

  if (params.experience) {
    filters.experienceId = params.experience;
  }

  if (params.status) {
    filters.status = params.status as TransactionStatus;
  }

  // Fetch all data in parallel
  const [summary, monthlyEarnings, transactions, ytdSummary, experiences] =
    await Promise.all([
      getEarningsSummary(wineryId),
      getMonthlyEarnings(wineryId, 6),
      getTransactions(wineryId, filters),
      getYearToDateSummary(wineryId),
      getWineryExperiencesForEarnings(wineryId),
    ]);

  return (
    <>
      {/* Summary Cards */}
      <EarningsSummaryCards summary={summary} />

      {/* Chart and YTD Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <EarningsChartLazy data={monthlyEarnings} />
        <YearToDateSummary summary={ytdSummary} />
      </div>

      {/* Payout Schedule Info */}
      <PayoutScheduleInfo />

      {/* Transactions Section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
          <TransactionFilters experiences={experiences} />
        </div>

        {/* Results Info */}
        <p className="text-sm text-slate-600">
          {transactions.length} transaction
          {transactions.length !== 1 ? 's' : ''}
          {Object.keys(filters).length > 0 && ' (filtered)'}
        </p>

        {/* Transaction Table */}
        <TransactionTable transactions={transactions} />
      </div>

      {/* Tax Info Note */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Tax Information</p>
        <p className="mt-1">
          For tax purposes, please consult your accountant. Full records of all
          transactions are available in your Stripe dashboard.
        </p>
      </div>
    </>
  );
}
