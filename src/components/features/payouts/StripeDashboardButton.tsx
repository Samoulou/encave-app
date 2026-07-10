'use client';

import { useTransition } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getStripeDashboardLink } from '@/server/actions/stripe';

/** « Ouvrir dans Stripe » — Express dashboard login link (ENC-114). */
export function StripeDashboardButton() {
  const t = useTranslations('Payouts');
  const [isPending, startTransition] = useTransition();

  const onOpen = () => {
    startTransition(async () => {
      const result = await getStripeDashboardLink();
      if (result.success) {
        window.open(result.data.url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error(t('error.fetch'));
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={onOpen}
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      {t('openInStripe')}
    </Button>
  );
}
