import { Info } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function PayoutScheduleInfo() {
  const t = await getTranslations('earnings.payout');

  return (
    <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4">
      <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
      <div className="text-sm text-blue-900">
        <p className="font-medium">{t('title')}</p>
        <p className="mt-1 text-blue-700">
          {t('description')}
        </p>
      </div>
    </div>
  );
}
