'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, Compass, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');
  const tBookingError = useTranslations('bookingError');

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" />
        </div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">
          {t('serverError')}
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-ink-700">
          {t('serverErrorDescription')}
        </p>
        {error.digest && (
          <p className="mt-4 font-mono text-xs text-ink-500">
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()} size="lg">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            {tCommon('buttons.tryAgain')}
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/experiences">
              <Compass className="mr-2 h-4 w-4" aria-hidden="true" />
              {tBookingError('generic.cta')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
