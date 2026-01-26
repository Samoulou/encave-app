'use client';

import { useState, useMemo, memo } from 'react';
import { format } from 'date-fns';
import { MoreVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { formatCHF } from '@/lib/utils/currency';
import { TransactionStatusBadge } from './TransactionStatusBadge';
import { Pagination } from '@/components/shared/Pagination';
import type { Transaction } from '@/server/queries/earnings.queries';

interface TransactionTableProps {
  transactions: Transaction[];
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * Generate initials from a name for avatar fallback.
 */
function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? '').toUpperCase();
}

function TransactionTableComponent({ transactions }: TransactionTableProps) {
  const t = useTranslations('earnings.transactions');

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
      <div className="rounded-xl border border-[#e5d2d7] bg-white p-8 text-center shadow-sm">
        <p className="text-[#915564]">{t('noTransactions')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#e5d2d7] bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50 border-b border-[#e5d2d7] text-[#915564] font-medium uppercase text-xs tracking-wider">
            <tr>
              <th scope="col" className="px-6 py-4">
                {t('date')}
              </th>
              <th scope="col" className="px-6 py-4">
                {t('bookingId')}
              </th>
              <th scope="col" className="px-6 py-4">
                {t('experience')}
              </th>
              <th scope="col" className="px-6 py-4">
                {t('customer')}
              </th>
              <th scope="col" className="px-6 py-4 text-right">
                {t('amount')}
              </th>
              <th scope="col" className="px-6 py-4 text-center">
                {t('status')}
              </th>
              <th scope="col" className="px-6 py-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2e9eb] text-[#1a0f12]">
            {paginatedTransactions.map((transaction) => (
              <tr
                key={transaction.id}
                className="hover:bg-[#f8f6f6] transition-colors"
              >
                {/* Date */}
                <td className="px-6 py-4 font-medium">
                  {format(transaction.date, 'MMM d, yyyy')}
                </td>

                {/* Booking ID */}
                <td className="px-6 py-4 text-[#915564] font-mono text-xs">
                  #{transaction.bookingId}
                </td>

                {/* Experience */}
                <td className="px-6 py-4">{transaction.experienceTitle}</td>

                {/* Customer */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {transaction.customer.avatarUrl ? (
                      <div
                        className="h-6 w-6 rounded-full bg-gray-200 bg-cover bg-center flex-shrink-0"
                        style={{
                          backgroundImage: `url(${transaction.customer.avatarUrl})`,
                        }}
                        aria-hidden="true"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {getInitials(transaction.customer.name)}
                      </div>
                    )}
                    <span>{transaction.customer.name}</span>
                  </div>
                </td>

                {/* Amount */}
                <td className="px-6 py-4 text-right font-bold tabular-nums">
                  {formatCHF(transaction.grossAmount)}
                </td>

                {/* Status */}
                <td className="px-6 py-4 text-center">
                  <TransactionStatusBadge status={transaction.status} />
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#915564] hover:text-primary hover:bg-transparent"
                      >
                        <MoreVertical className="h-5 w-5" />
                        <span className="sr-only">{t('openMenu')}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>{t('viewDetails')}</DropdownMenuItem>
                      <DropdownMenuItem>{t('downloadReceipt')}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {transactions.length > DEFAULT_PAGE_SIZE && (
        <div className="border-t border-[#e5d2d7] p-4">
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
    </div>
  );
}

// Memoized export to prevent unnecessary re-renders
export const TransactionTable = memo(TransactionTableComponent);
