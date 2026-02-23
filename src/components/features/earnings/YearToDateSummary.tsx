import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTranslations } from 'next-intl/server';
import { formatCHF } from '@/lib/utils/currency';
import type { YearToDateSummary as YTDSummary } from '@/server/queries/earnings.queries';

interface YearToDateSummaryProps {
  summary: YTDSummary;
}

export async function YearToDateSummary({ summary }: YearToDateSummaryProps) {
  const t = await getTranslations('earnings.yearToDate');
  const currentYear = new Date().getFullYear();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('title', { year: currentYear })}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm text-slate-500">{t('grossRevenue')}</p>
            <p className="text-xl font-semibold text-slate-900">
              {formatCHF(summary.grossRevenue)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-500">{t('platformFees')}</p>
            <p className="text-xl font-semibold text-red-600">
              -{formatCHF(summary.platformFees)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-500">{t('netEarnings')}</p>
            <p className="text-xl font-semibold text-emerald-600">
              {formatCHF(summary.netEarnings)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-500">{t('totalBookings')}</p>
            <p className="text-xl font-semibold text-slate-900">
              {summary.totalBookings}
            </p>
          </div>
        </div>
        {summary.refundedAmount > 0 && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {t('refundedThisYear', { amount: formatCHF(summary.refundedAmount) })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
