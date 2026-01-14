'use client';

import { useState, useMemo, memo } from 'react';
import { format } from 'date-fns';
import { Info } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import { formatCHF } from '@/lib/utils/currency';
import { TransactionStatusBadge } from './TransactionStatusBadge';
import { PayoutBreakdownTooltip } from './PayoutBreakdownTooltip';
import { Pagination } from '@/components/shared/Pagination';
import type { Transaction } from '@/server/queries/earnings.queries';

interface TransactionTableProps {
  transactions: Transaction[];
}

const DEFAULT_PAGE_SIZE = 20;

function TransactionTableComponent({ transactions }: TransactionTableProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Calculate paginated data
  const totalPages = Math.ceil(transactions.length / pageSize);
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return transactions.slice(startIndex, startIndex + pageSize);
  }, [transactions, currentPage, pageSize]);

  // Reset to page 1 when transactions change
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };
  if (transactions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-slate-600">No transactions found.</p>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Experience
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                  Guests
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                  Gross
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                  Fee
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                  Payout
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTransactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
                    {format(transaction.date, 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-900">
                      {transaction.experienceTitle}
                    </div>
                    <div className="text-xs text-slate-500">
                      {transaction.reference}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-slate-600">
                    {transaction.guestCount}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-900">
                    {formatCHF(transaction.grossAmount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <PayoutBreakdownTooltip
                      grossAmount={transaction.grossAmount}
                      platformFee={transaction.platformFee}
                      netPayout={transaction.netPayout}
                    >
                      <span className="inline-flex items-center gap-1 text-sm text-slate-500 cursor-help">
                        -{formatCHF(transaction.platformFee)}
                        <Info className="h-3 w-3" />
                      </span>
                    </PayoutBreakdownTooltip>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-emerald-600">
                    {formatCHF(transaction.netPayout)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    <TransactionStatusBadge status={transaction.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {transactions.length > DEFAULT_PAGE_SIZE && (
          <div className="border-t border-slate-200 p-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={transactions.length}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={[10, 20, 50]}
            />
          </div>
        )}
      </Card>
    </TooltipProvider>
  );
}

// Memoized export to prevent unnecessary re-renders
export const TransactionTable = memo(TransactionTableComponent);
