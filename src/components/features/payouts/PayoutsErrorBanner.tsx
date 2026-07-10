'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/** ENC-114 error state: Stripe unreachable → banner + retry. */
export function PayoutsErrorBanner() {
  const t = useTranslations('Payouts.error');
  const router = useRouter();

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
          aria-hidden="true"
        />
        <p className="text-sm text-amber-900">{t('fetch')}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => router.refresh()}
      >
        <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
        {t('retry')}
      </Button>
    </div>
  );
}
