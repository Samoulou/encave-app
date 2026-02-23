'use client';

import { Wallet, Calendar, Clock, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { formatCHF } from '@/lib/utils/currency';
import type { EarningsSummary } from '@/server/queries/earnings.queries';
import { cn } from '@/lib/utils';

interface EarningsSummaryCardsProps {
  summary: EarningsSummary;
}

/**
 * KPI summary cards for the earnings dashboard.
 * Displays 3 cards matching the mockup:
 * 1. Total Earnings (current month with trend)
 * 2. Year to Date (gross revenue)
 * 3. Pending Payouts (with estimated arrival)
 */
export function EarningsSummaryCards({ summary }: EarningsSummaryCardsProps) {
  const t = useTranslations('earnings.summary');

  // Calculate trend percentage
  const trendPercentage =
    summary.lastMonth > 0
      ? ((summary.thisMonth - summary.lastMonth) / summary.lastMonth) * 100
      : summary.thisMonth > 0
        ? 100
        : 0;
  const trendIsPositive = trendPercentage >= 0;

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      {/* Card 1 - Total Earnings (Current Month) */}
      <div className="flex flex-col justify-between h-40 p-6 bg-white rounded-xl border border-border shadow-sm group hover:border-primary/30 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-[#915564] text-sm font-medium">
            {t('totalEarnings')} ({summary.currentMonthLabel})
          </p>
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Wallet className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-extrabold text-foreground tabular-nums">
            {formatCHF(summary.thisMonth)}
          </h3>
          {summary.lastMonth > 0 && (
            <div
              className={cn(
                'flex items-center gap-1 mt-2 text-sm font-bold',
                trendIsPositive ? 'text-green-600' : 'text-red-600'
              )}
            >
              {trendIsPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>
                {trendIsPositive ? '+' : ''}
                {trendPercentage.toFixed(1)}%
              </span>
              <span className="text-[#915564] font-normal ml-1">{t('vsLastMonth')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card 2 - Year to Date */}
      <div className="flex flex-col justify-between h-40 p-6 bg-white rounded-xl border border-border shadow-sm group hover:border-primary/30 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-[#915564] text-sm font-medium">{t('yearToDate')}</p>
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Calendar className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-extrabold text-foreground tabular-nums">
            {formatCHF(summary.yearToDate)}
          </h3>
          <div className="flex items-center gap-1 mt-2 text-sm text-[#915564] font-medium">
            <Info className="h-4 w-4" />
            <span>{t('grossRevenue')}</span>
          </div>
        </div>
      </div>

      {/* Card 3 - Pending Payouts */}
      <div className="flex flex-col justify-between h-40 p-6 bg-white rounded-xl border border-border shadow-sm group hover:border-primary/30 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-[#915564] text-sm font-medium">{t('pendingPayouts')}</p>
          <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-extrabold text-foreground tabular-nums">
            {formatCHF(summary.pendingPayout)}
          </h3>
          <div className="flex items-center gap-1 mt-2 text-sm text-[#915564] font-medium">
            <span>{t('estArrival')}</span>
            <span className="text-foreground font-bold">
              {summary.nextPayoutDate
                ? format(summary.nextPayoutDate, 'MMM d')
                : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
