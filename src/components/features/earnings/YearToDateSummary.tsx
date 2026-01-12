import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCHF } from '@/lib/utils/currency';
import type { YearToDateSummary as YTDSummary } from '@/server/queries/earnings.queries';

interface YearToDateSummaryProps {
  summary: YTDSummary;
}

export function YearToDateSummary({ summary }: YearToDateSummaryProps) {
  const currentYear = new Date().getFullYear();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Year-to-Date Summary ({currentYear})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Gross Revenue</p>
            <p className="text-xl font-semibold text-slate-900">
              {formatCHF(summary.grossRevenue)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Platform Fees</p>
            <p className="text-xl font-semibold text-red-600">
              -{formatCHF(summary.platformFees)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Net Earnings</p>
            <p className="text-xl font-semibold text-emerald-600">
              {formatCHF(summary.netEarnings)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Total Bookings</p>
            <p className="text-xl font-semibold text-slate-900">
              {summary.totalBookings}
            </p>
          </div>
        </div>
        {summary.refundedAmount > 0 && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Refunded this year: {formatCHF(summary.refundedAmount)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
