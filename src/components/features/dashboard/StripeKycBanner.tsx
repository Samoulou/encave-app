import { Fragment } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

interface StripeKycBannerProps {
  stripeOnboardingComplete: boolean;
}

/**
 * KYC incomplete warning (P-13: extracted from the earnings inline
 * banner so the Aujourd'hui landing and earnings share one component).
 * Renders nothing when onboarding is complete.
 */
export async function StripeKycBanner({
  stripeOnboardingComplete,
}: StripeKycBannerProps) {
  if (stripeOnboardingComplete) return null;
  const t = await getTranslations('stripe.onboarding');

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
      <div className="text-sm text-amber-900">
        <p className="font-medium">{t('completeSetupTitle')}</p>
        <p className="mt-1 text-amber-700">
          {t('completeSetupDescription', { wineryProfileLink: '__LINK__' })
            .split('__LINK__')
            .map((part, i, arr) =>
              i < arr.length - 1 ? (
                <Fragment key={i}>
                  {part}
                  <a href="/dashboard/winery/profile" className="underline">
                    {t('wineryProfileLink')}
                  </a>
                </Fragment>
              ) : (
                part
              )
            )}
        </p>
      </div>
    </div>
  );
}
