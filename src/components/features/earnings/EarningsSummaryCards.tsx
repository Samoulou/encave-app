'use client';

import {
  Wallet,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatCHF } from '@/lib/utils/currency';
import { formatDateShort } from '@/lib/i18n/formatters';
import type { EarningsSummary } from '@/server/queries/earnings.queries';
import type { NextPayoutDTO } from '@/server/queries/payouts.queries';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n/routing';

interface EarningsSummaryCardsProps {
  summary: EarningsSummary;
  /** Real Stripe data (P-13 / L-141) — null when unavailable (API down
   * or account not connected): the card degrades, never guesses. */
  nextPayout: NextPayoutDTO | null;
}

/**
 * KPI summary cards for the earnings dashboard.
 * Displays 3 cards matching the mockup:
 * 1. Total Earnings (current month with trend)
 * 2. Year to Date (gross revenue)
 * 3. Next payout — REAL Stripe data (the J+5 heuristic is gone)
 */
export function EarningsSummaryCards({
  summary,
  nextPayout,
}: EarningsSummaryCardsProps) {
  const t = useTranslations('earnings.summary');
  const locale = useLocale() as Locale;

  // Calculate trend percentage
  const trendPercentage =
    summary.lastMonth > 0
      ? ((summary.thisMonth - summary.lastMonth) / summary.lastMonth) * 100
      : summary.thisMonth > 0
        ? 100
        : 0;
  const trendIsPositive = trendPercentage >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Card 1 - Total Earnings (Current Month) */}
      <div className="group flex h-40 flex-col justify-between rounded-xl border border-border bg-white p-6 shadow-sm transition-colors hover:border-primary/30">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            {t('totalEarnings')} ({summary.currentMonthLabel})
          </p>
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Wallet className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-extrabold tabular-nums text-foreground">
            {formatCHF(summary.thisMonth)}
          </h3>
          {summary.lastMonth > 0 && (
            <div
              className={cn(
                'mt-2 flex items-center gap-1 text-sm font-bold',
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
              <span className="ml-1 font-normal text-muted-foreground">
                {t('vsLastMonth')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card 2 - Year to Date */}
      <div className="group flex h-40 flex-col justify-between rounded-xl border border-border bg-white p-6 shadow-sm transition-colors hover:border-primary/30">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            {t('yearToDate')}
          </p>
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Calendar className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-extrabold tabular-nums text-foreground">
            {formatCHF(summary.yearToDate)}
          </h3>
          <div className="mt-2 flex items-center gap-1 text-sm font-medium text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>{t('grossRevenue')}</span>
          </div>
        </div>
      </div>

      {/* Card 3 - Next payout (real Stripe data, P-13) */}
      <div className="group flex h-40 flex-col justify-between rounded-xl border border-border bg-white p-6 shadow-sm transition-colors hover:border-primary/30">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            {t('nextPayout')}
          </p>
          <div className="rounded-lg bg-yellow-50 p-2 text-yellow-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-extrabold tabular-nums text-foreground">
            {nextPayout !== null && nextPayout.kind !== 'none'
              ? formatCHF(nextPayout.amountCents)
              : '—'}
          </h3>
          <div className="mt-2 flex items-center gap-1 text-sm font-medium text-muted-foreground">
            {nextPayout === null ? (
              <span>{t('nextPayoutUnavailable')}</span>
            ) : nextPayout.kind === 'payout' ? (
              <>
                <span>{t('estArrival')}</span>
                <span className="font-bold text-foreground">
                  {formatDateShort(new Date(nextPayout.arrivalDateMs), locale)}
                </span>
              </>
            ) : nextPayout.kind === 'balance' ? (
              <span>{t('nextPayoutAccruing')}</span>
            ) : (
              <span>{t('nextPayoutNone')}</span>
            )}
            <Link
              href="/dashboard/payouts"
              className="ml-auto font-bold text-primary hover:underline"
            >
              {t('nextPayoutLink')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
