import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { formatCHF } from '@/lib/utils/currency';

interface GmvHighlightCardProps {
  /** Cumulated GMV in cents (CONFIRMED + COMPLETED bookings). */
  gmvCents: number;
}

/**
 * "EnCave vous a apporté X CHF" highlight (P-03 / L-044): the winery's
 * cumulated GMV through the platform, amount set in Fraunces (font-display)
 * per the design conventions for prices and KPIs.
 */
export function GmvHighlightCard({ gmvCents }: GmvHighlightCardProps) {
  const t = useTranslations('earnings.gmv');

  return (
    <div
      className="flex flex-col justify-between gap-4 rounded-xl border border-burgundy-100 bg-gradient-to-br from-burgundy-50 to-white p-6 shadow-sm sm:flex-row sm:items-center"
      data-testid="earnings-gmv-card"
    >
      <div>
        <p className="text-sm font-medium text-[#915564]">{t('title')}</p>
        <p className="mt-1 font-display text-4xl font-semibold tabular-nums text-burgundy-700">
          {formatCHF(gmvCents)}
        </p>
        <p className="mt-2 text-sm text-[#915564]">{t('description')}</p>
      </div>
      <div className="hidden rounded-lg bg-burgundy-100 p-3 text-burgundy-700 sm:block">
        <Sparkles className="h-6 w-6" aria-hidden="true" />
      </div>
    </div>
  );
}
