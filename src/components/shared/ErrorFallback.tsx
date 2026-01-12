'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  error?: Error;
  resetErrorBoundary?: () => void;
  title?: string;
  description?: string;
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
  title,
  description,
}: ErrorFallbackProps) {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" />
      </div>

      <h2 className="font-display text-xl font-semibold text-slate-900">
        {title || t('somethingWentWrong')}
      </h2>

      <p className="mt-2 max-w-sm text-sm text-slate-600">
        {description || t('genericError')}
      </p>

      {error?.message && process.env.NODE_ENV === 'development' && (
        <p className="mt-3 max-w-sm font-mono text-xs text-slate-400">
          {error.message}
        </p>
      )}

      {resetErrorBoundary && (
        <Button onClick={resetErrorBoundary} className="mt-6">
          <RefreshCw className="mr-2 h-4 w-4" />
          {tCommon('buttons.tryAgain')}
        </Button>
      )}
    </div>
  );
}
