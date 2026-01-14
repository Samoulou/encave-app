import {
  TransactionFilters,
  TransactionTable,
} from '@/components/features/earnings';
import {
  getTransactions,
  getWineryExperiencesForEarnings,
  type TransactionFilters as TransactionFiltersType,
  type TransactionStatus,
} from '@/server/queries/earnings.queries';

interface EarningsTransactionsSectionProps {
  wineryId: string;
  params: {
    month?: string;
    experience?: string;
    status?: string;
  };
}

/**
 * Async server component for transactions section.
 * This is typically the heaviest query, designed to stream last.
 */
export async function EarningsTransactionsSection({ wineryId, params }: EarningsTransactionsSectionProps) {
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

  // Fetch transactions and experience options in parallel
  const [transactions, experiences] = await Promise.all([
    getTransactions(wineryId, filters),
    getWineryExperiencesForEarnings(wineryId),
  ]);

  return (
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
  );
}
