'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, LayoutDashboard, RefreshCw } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { logError } from '@/lib/logger';

interface EventDetailErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EventDetailError({
  error,
  reset,
}: EventDetailErrorProps) {
  const t = useTranslations('Dashboard.eventDetail.errors');
  const tCommon = useTranslations('common');

  useEffect(() => {
    logError('Event detail page error', error, {
      action: 'EventDetailPage.render',
    });
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" />
      </div>
      <h1 className="font-display text-2xl font-bold text-slate-900 md:text-3xl">
        {t('loadFailed')}
      </h1>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-slate-400">
          Error ID: {error.digest}
        </p>
      ) : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => reset()} size="lg">
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {tCommon('buttons.tryAgain')}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/dashboard">
            <LayoutDashboard className="mr-2 h-4 w-4" aria-hidden="true" />
            {tCommon('buttons.goHome')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
