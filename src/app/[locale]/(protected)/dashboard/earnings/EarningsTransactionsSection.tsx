import { TransactionTable } from '@/components/features/earnings/TransactionTable';
import {
  getTransactions,
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

  // Fetch transactions
  const transactions = await getTransactions(wineryId, filters);

  return (
    <div className="flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Recent Transactions</h2>
      </div>

      {/* Transaction Table */}
      <TransactionTable transactions={transactions} />
    </div>
  );
}
