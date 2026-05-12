import { AlertCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ConfirmationPaymentFailedProps {
  /**
   * Slug de l'expérience à relancer. Le CTA principal renvoie le client sur
   * `/experiences/[slug]` pour repartir d'un parcours neuf (décision Sam :
   * pas de retry sur le bookingId courant).
   */
  experienceSlug: string;
}

/**
 * ENC-067 — État 3 : paiement instantané échoué.
 *
 * Carte refusée, 3DS abandonné, fonds insuffisants. Le booking reste en
 * PENDING_PAYMENT côté DB et sera nettoyé par le cron 30 min — on ne le
 * dit pas au client pour éviter l'anxiété.
 *
 * Décision Sam : pas de retry inline. CTA principal = nouveau parcours
 * depuis la page expérience.
 */
export async function ConfirmationPaymentFailed({
  experienceSlug,
}: ConfirmationPaymentFailedProps) {
  const t = await getTranslations('booking.confirmation.failed');

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
      <Alert variant="destructive">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
        <AlertTitle className="text-base font-semibold">
          {t('title')}
        </AlertTitle>
        <AlertDescription className="mt-2 text-sm leading-relaxed">
          {t('message')}
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="w-full sm:flex-1">
          <Link href={`/experiences/${experienceSlug}`}>
            {t('cta.newBooking')}
          </Link>
        </Button>
        <Button asChild variant="ghost" size="lg" className="w-full sm:flex-1">
          <Link href="/dashboard/my-bookings">{t('cta.myBookings')}</Link>
        </Button>
      </div>

      <div className="mt-4 border-t border-border pt-4 text-center text-sm text-muted-foreground">
        {t.rich('support', {
          link: (chunks) => (
            <a
              href="mailto:contact@encave.ch"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {chunks}
            </a>
          ),
        })}
      </div>
    </div>
  );
}
