'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createRequestOfferCheckout } from '@/server/actions/request';

/**
 * Tokenized offer payment CTA (P-10 / L-092). Starts the Stripe Checkout
 * for the offer and redirects the browser to the hosted session. Public —
 * the token is the capability; the action re-validates it server-side.
 */
export function PayOfferButton({ token }: { token: string }) {
  const t = useTranslations('surMesure');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onPay() {
    setError(null);
    startTransition(async () => {
      const result = await createRequestOfferCheckout({ token });
      if (result.success) {
        window.location.href = result.data.checkoutUrl;
        return;
      }
      setError(t('offerPayError'));
    });
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={onPay}
        disabled={isPending}
      >
        <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
        {isPending ? t('offerPaying') : t('offerPayCta')}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
