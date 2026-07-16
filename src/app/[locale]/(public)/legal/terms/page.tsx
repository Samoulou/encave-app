import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });

  return {
    title: t('terms.title'),
    description: t('terms.description'),
  };
}

export default async function TermsOfServicePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('legal');

  return (
    <>
      <h1>{t('terms.title')}</h1>
      <p className="lead">{t('terms.lastUpdated', { date: '2026-07-16' })}</p>

      <h2>{t('terms.sections.acceptance.title')}</h2>
      <p>{t('terms.sections.acceptance.content')}</p>

      <h2>{t('terms.sections.services.title')}</h2>
      <p>{t('terms.sections.services.content')}</p>

      <h2>{t('terms.sections.accounts.title')}</h2>
      <p>{t('terms.sections.accounts.content')}</p>
      <ul>
        <li>{t('terms.sections.accounts.items.accuracy')}</li>
        <li>{t('terms.sections.accounts.items.security')}</li>
        <li>{t('terms.sections.accounts.items.responsibility')}</li>
      </ul>

      <h2>{t('terms.sections.bookings.title')}</h2>
      <p>{t('terms.sections.bookings.content')}</p>

      <h2>{t('terms.sections.payments.title')}</h2>
      <p>{t('terms.sections.payments.content')}</p>

      {/* P-16 (WS-H, L-185): launch-pillar clauses — gift cards, no-show
          fees, sur-mesure, per-winery cancellation, booking fee, and the
          collective-events roster disclosure (nLPD debt from P-11). */}
      <h2>{t('terms.sections.bookingFee.title')}</h2>
      <p>{t('terms.sections.bookingFee.content')}</p>

      <h2>{t('terms.sections.cancellationPolicies.title')}</h2>
      <p>{t('terms.sections.cancellationPolicies.content')}</p>
      <ul>
        <li>{t('terms.sections.cancellationPolicies.items.flexible')}</li>
        <li>{t('terms.sections.cancellationPolicies.items.standard')}</li>
        <li>{t('terms.sections.cancellationPolicies.items.strict')}</li>
      </ul>
      <p>{t('terms.sections.cancellationPolicies.snapshot')}</p>

      <h2>{t('terms.sections.giftCards.title')}</h2>
      <p>{t('terms.sections.giftCards.content')}</p>
      <ul>
        <li>{t('terms.sections.giftCards.items.validity')}</li>
        <li>{t('terms.sections.giftCards.items.partial')}</li>
        <li>{t('terms.sections.giftCards.items.noCash')}</li>
        <li>{t('terms.sections.giftCards.items.cancellation')}</li>
      </ul>

      <h2>{t('terms.sections.noShow.title')}</h2>
      <p>{t('terms.sections.noShow.content')}</p>

      <h2>{t('terms.sections.surMesure.title')}</h2>
      <p>{t('terms.sections.surMesure.content')}</p>

      <h2>{t('terms.sections.collectiveEvents.title')}</h2>
      <p>{t('terms.sections.collectiveEvents.content')}</p>

      <h2>{t('terms.sections.winemakers.title')}</h2>
      <p>{t('terms.sections.winemakers.content')}</p>

      <h2>{t('terms.sections.intellectual.title')}</h2>
      <p>{t('terms.sections.intellectual.content')}</p>

      <h2>{t('terms.sections.liability.title')}</h2>
      <p>{t('terms.sections.liability.content')}</p>

      <h2>{t('terms.sections.modifications.title')}</h2>
      <p>{t('terms.sections.modifications.content')}</p>

      <h2>{t('terms.sections.governing.title')}</h2>
      <p>{t('terms.sections.governing.content')}</p>

      <h2>{t('terms.sections.contact.title')}</h2>
      <p>{t('terms.sections.contact.content')}</p>
      <p>
        <strong>EnCave SA</strong>
        <br />
        Email: legal@encave.ch
        <br />
        {t('terms.sections.contact.address')}
      </p>
    </>
  );
}
