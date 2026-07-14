import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });

  return {
    title: t('privacy.title'),
    description: t('privacy.description'),
  };
}

export default async function PrivacyPolicyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('legal');

  return (
    <>
      <h1>{t('privacy.title')}</h1>
      <p className="lead">{t('privacy.lastUpdated', { date: '2026-01-12' })}</p>

      <h2>{t('privacy.sections.introduction.title')}</h2>
      <p>{t('privacy.sections.introduction.content')}</p>

      <h2>{t('privacy.sections.dataCollection.title')}</h2>
      <p>{t('privacy.sections.dataCollection.content')}</p>
      <ul>
        <li>{t('privacy.sections.dataCollection.items.personal')}</li>
        <li>{t('privacy.sections.dataCollection.items.payment')}</li>
        <li>{t('privacy.sections.dataCollection.items.usage')}</li>
        <li>{t('privacy.sections.dataCollection.items.cookies')}</li>
      </ul>

      <h2>{t('privacy.sections.dataUsage.title')}</h2>
      <p>{t('privacy.sections.dataUsage.content')}</p>
      <ul>
        <li>{t('privacy.sections.dataUsage.items.booking')}</li>
        <li>{t('privacy.sections.dataUsage.items.communication')}</li>
        <li>{t('privacy.sections.dataUsage.items.improvement')}</li>
        <li>{t('privacy.sections.dataUsage.items.legal')}</li>
      </ul>

      <h2>{t('privacy.sections.dataSharing.title')}</h2>
      <p>{t('privacy.sections.dataSharing.content')}</p>

      <h2>{t('privacy.sections.subprocessors.title')}</h2>
      <p>{t('privacy.sections.subprocessors.content')}</p>
      <ul>
        <li>{t('privacy.sections.subprocessors.items.vercel')}</li>
        <li>{t('privacy.sections.subprocessors.items.neon')}</li>
        <li>{t('privacy.sections.subprocessors.items.stripe')}</li>
        <li>{t('privacy.sections.subprocessors.items.resend')}</li>
        <li>{t('privacy.sections.subprocessors.items.posthog')}</li>
      </ul>

      <h2>{t('privacy.sections.security.title')}</h2>
      <p>{t('privacy.sections.security.content')}</p>

      <h2>{t('privacy.sections.rights.title')}</h2>
      <p>{t('privacy.sections.rights.content')}</p>
      <ul>
        <li>{t('privacy.sections.rights.items.access')}</li>
        <li>{t('privacy.sections.rights.items.rectification')}</li>
        <li>{t('privacy.sections.rights.items.deletion')}</li>
        <li>{t('privacy.sections.rights.items.portability')}</li>
      </ul>

      <h2>{t('privacy.sections.contact.title')}</h2>
      <p>{t('privacy.sections.contact.content')}</p>
      <p>
        <strong>EnCave SA</strong>
        <br />
        Email: privacy@encave.ch
        <br />
        {t('privacy.sections.contact.address')}
      </p>
    </>
  );
}
