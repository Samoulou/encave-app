import { TrendingUp, Calendar, Clock, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { formatCHF } from '@/lib/utils/currency';
import type { EarningsSummary } from '@/server/queries/earnings.queries';

interface EarningsSummaryCardsProps {
  summary: EarningsSummary;
}

export function EarningsSummaryCards({ summary }: EarningsSummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Earnings */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50">
            <TrendingUp className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total Earnings</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatCHF(summary.totalEarnings)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* This Month */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">This Month</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatCHF(summary.thisMonth)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pending Payout */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Pending Payout</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatCHF(summary.pendingPayout)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Next Payout Date */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-burgundy-50">
            <Banknote className="h-6 w-6 text-burgundy-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Next Payout</p>
            <p className="text-2xl font-semibold text-slate-900">
              {summary.nextPayoutDate
                ? format(summary.nextPayoutDate, 'MMM d')
                : '—'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
