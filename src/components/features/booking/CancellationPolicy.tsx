'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';

export function CancellationPolicy() {
  const t = useTranslations('cancellation');

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-amber-800 mb-2">{t('title')}</p>
          <ul className="space-y-1 text-amber-700">
            <li>{t('free24Hours')}</li>
            <li>{t('halfRefund')}</li>
            <li>{t('noRefund')}</li>
          </ul>
          <p className="mt-2 text-xs text-amber-600">
            {t('contactForChanges')}
          </p>
        </div>
      </div>
    </div>
  );
}
