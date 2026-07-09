import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { formatCHF } from '@/lib/utils/currency';
import type { AdminBusinessKpis as AdminBusinessKpisData } from '@/server/queries/admin-metrics.queries';

interface AdminBusinessKpisProps {
  kpis: AdminBusinessKpisData;
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-burgundy-600" />
      <CardContent className="p-6">
        <p className="font-display text-2xl font-semibold tabular-nums text-burgundy-700">
          {value}
        </p>
        <p className="mt-1 text-sm text-slate-600">{label}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Business KPIs row for the admin dashboard (P-03 / L-045):
 * GMV, tickets this month, blended take rate, gift-card revenue/liability.
 */
export function AdminBusinessKpis({ kpis }: AdminBusinessKpisProps) {
  const t = useTranslations('admin.businessKpis');

  return (
    <section aria-label={t('title')} className="mt-8">
      <h2 className="mb-4 font-display text-xl font-semibold text-slate-900">
        {t('title')}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label={t('gmv')} value={formatCHF(kpis.gmvCents)} />
        <KpiCard
          label={t('ticketsThisMonth')}
          value={String(kpis.ticketsThisMonth)}
        />
        <KpiCard
          label={t('takeRate')}
          value={`${kpis.takeRatePercent.toFixed(1)} %`}
        />
        <KpiCard
          label={t('giftCardRevenue')}
          value={formatCHF(kpis.giftCardRevenueCents)}
        />
        <KpiCard
          label={t('giftCardLiability')}
          value={formatCHF(kpis.giftCardLiabilityCents)}
        />
      </div>
    </section>
  );
}
