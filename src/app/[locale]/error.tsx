'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, Home, RefreshCw, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream-50 px-4">
      <div className="w-full max-w-md text-center">
        {/* Error Icon */}
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle
            className="h-12 w-12 text-red-600"
            aria-hidden="true"
          />
        </div>

        {/* Title & Description */}
        <h1 className="font-display text-4xl font-bold text-slate-900">
          {t('serverError')}
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          {t('serverErrorDescription')}
        </p>

        {/* Error Digest (for debugging) */}
        {error.digest && (
          <p className="mt-4 font-mono text-xs text-slate-400">
            Error ID: {error.digest}
          </p>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()} size="lg">
            <RefreshCw className="mr-2 h-4 w-4" />
            {tCommon('buttons.tryAgain')}
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              {tCommon('buttons.goHome')}
            </Link>
          </Button>
        </div>

        {/* Support Contact */}
        <div className="mt-10 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>{t('supportContact')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
