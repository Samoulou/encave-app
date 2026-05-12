import { getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';

/**
 * ENC-067 — État 1 : finalisation en cours.
 *
 * Affiché par le `<Suspense fallback>` de la page de confirmation pendant
 * que `reconcileBookingPayment` interroge Stripe. Sobriété + skeleton qui
 * mime la structure de l'état "confirmé" pour rassurer le client.
 *
 * Aucune interactivité, pas de polling client — c'est juste le fallback
 * Suspense rendu par le streaming RSC.
 */
export async function ConfirmationFinalizing() {
  const t = await getTranslations('booking.confirmation.finalizing');

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-12 sm:px-6">
      <SkeletonContainer label={t('srLabel')} className="w-full">
        <Card className="w-full rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <CardContent className="flex flex-col items-center gap-6 p-0">
            <Skeleton className="h-16 w-16 rounded-full" />

            <div className="flex w-full flex-col items-center gap-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>

            <div className="w-full border-t border-border" />

            <div className="flex w-full flex-col items-center gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground sm:text-base">
          <span className="block font-medium text-foreground">
            {t('title')}
          </span>
          <span className="mt-1 block">{t('subtitle')}</span>
        </p>
      </SkeletonContainer>
    </div>
  );
}
