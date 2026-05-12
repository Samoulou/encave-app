'use client';

import { useState } from 'react';
import { CreditCard, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { startStripeOnboarding } from '@/server/actions/stripe';
import { toast } from 'sonner';

interface StripeOnboardingProps {
  wineryId: string;
}

export function StripeOnboarding({ wineryId }: StripeOnboardingProps) {
  const t = useTranslations('stripe.onboarding');
  const [isLoading, setIsLoading] = useState(false);

  const handleSetupPayments = async () => {
    setIsLoading(true);
    try {
      const result = await startStripeOnboarding(wineryId);

      if (result.success) {
        // Redirect to Stripe onboarding
        window.location.href = result.data.url;
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error(t('failedToStart'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-gold-300 bg-gradient-to-r from-gold-50 to-cream-50">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gold-100">
            <CreditCard className="h-6 w-6 text-gold-700" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-900">
              {t('setupPayments')}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {t('setupPaymentsDescription')}
            </p>
          </div>
        </div>
        <Button
          onClick={handleSetupPayments}
          disabled={isLoading}
          className="flex-shrink-0"
        >
          {isLoading ? (
            <>
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              {t('connecting')}
            </>
          ) : (
            <>
              {t('getStarted')}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
