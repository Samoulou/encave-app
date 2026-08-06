'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';

export function CancellationPolicy() {
  const t = useTranslations('cancellation');

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="text-sm">
          <p className="mb-2 font-medium text-amber-800">{t('title')}</p>
          <ul className="space-y-1 text-amber-700">
            <li>{t('free24Hours')}</li>
            <li>{t('halfRefund')}</li>
            <li>{t('noRefund')}</li>
          </ul>
          {/* amber-700: amber-600 on white is ~3.3:1, under WCAG AA for
              12px text (axe color-contrast, P-16 / L-183). */}
          <p className="mt-2 text-xs text-amber-700">
            {t('contactForChanges')}
          </p>
        </div>
      </div>
    </div>
  );
}
