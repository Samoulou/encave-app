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
      <p className="lead">{t('terms.lastUpdated', { date: '2026-01-12' })}</p>

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
