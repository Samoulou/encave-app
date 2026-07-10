'use client';

import { useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, LayoutDashboard, RefreshCw, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EarningsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');

  useEffect(() => {
    console.error('Earnings error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle
            className="h-12 w-12 text-red-600"
            aria-hidden="true"
          />
        </div>
        <h1 className="font-display text-4xl font-bold text-foreground">
          {t('serverError')}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {t('serverErrorDescription')}
        </p>
        {error.digest && (
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()} size="lg">
            <RefreshCw className="mr-2 h-4 w-4" />
            {tCommon('buttons.tryAgain')}
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              {tCommon('buttons.goHome')}
            </Link>
          </Button>
        </div>
        <div className="mt-10 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>{t('supportContact')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
