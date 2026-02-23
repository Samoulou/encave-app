'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { startStripeOnboarding } from '@/server/actions/stripe';
import { toast } from 'sonner';

interface StripeWarningBannerProps {
  wineryId: string;
  message?: string;
  dismissible?: boolean;
}

export function StripeWarningBanner({
  wineryId,
  message,
  dismissible = true,
}: StripeWarningBannerProps) {
  const t = useTranslations('stripe.warning');
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  const handleFixIssue = async () => {
    setIsLoading(true);
    try {
      const result = await startStripeOnboarding(wineryId);
      if (result.success) {
        window.location.href = result.data.url;
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error(t('failedToOpen'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative rounded-lg border border-amber-200 bg-amber-50 p-4"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="h-5 w-5 flex-shrink-0 text-amber-600"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-amber-800">
            {t('actionRequired')}
          </h3>
          <p className="mt-1 text-sm text-amber-700">{message ?? t('defaultMessage')}</p>
          <div className="mt-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleFixIssue}
              disabled={isLoading}
              className="border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  {t('loading')}
                </>
              ) : (
                <>
                  {t('updateInformation')}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="flex-shrink-0 rounded p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-800"
            aria-label={t('dismissWarning')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
