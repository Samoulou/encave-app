import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import {
  EarningsSummaryCards,
  EarningsChart,
  TransactionFilters,
  TransactionTable,
  YearToDateSummary,
  PayoutScheduleInfo,
  ExportEarningsButton,
} from '@/components/features/earnings';
import {
  getEarningsSummary,
  getMonthlyEarnings,
  getTransactions,
  getYearToDateSummary,
  getWineryExperiencesForEarnings,
  type TransactionFilters as TransactionFiltersType,
  type TransactionStatus,
} from '@/server/queries/earnings.queries';

interface PageProps {
  searchParams: Promise<{
    month?: string;
    experience?: string;
    status?: string;
  }>;
}

export default async function EarningsPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;

  // Get winery for the user
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true, stripeOnboardingComplete: true },
  });

  if (!winery) {
    redirect('/onboarding/winery');
  }

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
      getEarningsSummary(winery.id),
      getMonthlyEarnings(winery.id, 6),
      getTransactions(winery.id, filters),
      getYearToDateSummary(winery.id),
      getWineryExperiencesForEarnings(winery.id),
    ]);

  return (
    <WineryAccessGuard>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-display-md text-slate-900">
              Earnings
            </h1>
            <p className="text-slate-600">
              Track your revenue and payouts from the platform
            </p>
          </div>
          <ExportEarningsButton />
        </div>

        {/* Stripe Onboarding Warning */}
        {!winery.stripeOnboardingComplete && (
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-4 border border-amber-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900">
              <p className="font-medium">Complete Stripe Setup</p>
              <p className="mt-1 text-amber-700">
                To receive payouts, you need to complete your Stripe account setup.
                Go to your{' '}
                <a href="/dashboard/winery/profile" className="underline">
                  Winery Profile
                </a>{' '}
                to complete the process.
              </p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <EarningsSummaryCards summary={summary} />

        {/* Chart and YTD Summary */}
        <div className="grid gap-6 lg:grid-cols-2">
          <EarningsChart data={monthlyEarnings} />
          <YearToDateSummary summary={ytdSummary} />
        </div>

        {/* Payout Schedule Info */}
        <PayoutScheduleInfo />

        {/* Transactions Section */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Transactions
            </h2>
            <TransactionFilters experiences={experiences} />
          </div>

          {/* Results Info */}
          <p className="text-sm text-slate-600">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
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
      </div>
    </WineryAccessGuard>
  );
}
