'use client';

import { useState } from 'react';
import { CheckCircle, Clock, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { startStripeOnboarding } from '@/server/actions/stripe';
import { toast } from 'sonner';

interface StripeCallbackResultProps {
  status: 'complete' | 'pending' | 'incomplete';
  isRefresh: boolean;
  wineryId: string;
}

export function StripeCallbackResult({
  status,
  isRefresh,
  wineryId,
}: StripeCallbackResultProps) {
  const t = useTranslations('stripe.callback');
  const [isLoading, setIsLoading] = useState(false);

  const handleContinueOnboarding = async () => {
    setIsLoading(true);
    try {
      const result = await startStripeOnboarding(wineryId);
      if (result.success) {
        window.location.href = result.data.url;
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error(t('failedToContinue'));
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'complete') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" aria-hidden="true" />
          </div>
          <CardTitle className="font-display text-2xl text-green-800">
            {t('setupComplete')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-6 text-green-700">
            {t('setupCompleteDescription')}
          </p>
          <Button asChild>
            <Link href="/dashboard/experiences">
              {t('goToExperiences')}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === 'pending') {
    return (
      <Card className="border-gold-200 bg-gold-50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold-100">
            <Clock className="h-8 w-8 text-gold-600" aria-hidden="true" />
          </div>
          <CardTitle className="font-display text-2xl text-gold-800">
            {t('verificationPending')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-6 text-gold-700">
            {t('verificationPendingDescription')}
          </p>
          <Button asChild variant="secondary">
            <Link href="/dashboard">
              {t('returnToDashboard')}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Incomplete - needs to continue onboarding
  return (
    <Card className="border-burgundy-200 bg-burgundy-50">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-burgundy-100">
          <AlertCircle className="h-8 w-8 text-burgundy-600" aria-hidden="true" />
        </div>
        <CardTitle className="font-display text-2xl text-burgundy-800">
          {isRefresh ? t('sessionExpired') : t('setupIncomplete')}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="mb-6 text-burgundy-700">
          {isRefresh
            ? t('sessionExpiredDescription')
            : t('setupIncompleteDescription')}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={handleContinueOnboarding} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                {t('loading')}
              </>
            ) : (
              <>
                {t('continueSetup')}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">{t('returnToDashboard')}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
