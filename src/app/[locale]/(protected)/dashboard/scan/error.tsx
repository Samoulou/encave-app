'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function ScanError({ reset }: { reset: () => void }) {
  const t = useTranslations('scan');
  const tCommon = useTranslations('common');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-xl font-semibold">{t('loadError')}</h2>
      <Button onClick={reset}>{tCommon('buttons.tryAgain')}</Button>
    </div>
  );
}
