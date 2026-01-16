'use client';

import { useTranslations } from 'next-intl';
import { formatCHF } from '@/lib/utils/currency';

interface PriceCalculatorProps {
  pricePerPerson: number; // in cents
  guests: number;
}

export function PriceCalculator({ pricePerPerson, guests }: PriceCalculatorProps) {
  const t = useTranslations('booking');

  const total = pricePerPerson * guests;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">{t('totalPrice')}</h3>

      {/* Calculation Breakdown */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <span>
            {formatCHF(pricePerPerson)} x {guests} {t('guests', { count: guests })}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-stone-200" />

      {/* Total */}
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-slate-700">{t('totalPrice')}</span>
        <span className="text-2xl font-bold text-slate-900">{formatCHF(total)}</span>
      </div>

      {/* Per Person Note */}
      <p className="text-xs text-center text-slate-400">
        {formatCHF(pricePerPerson)} {t('perPerson')}
      </p>
    </div>
  );
}
