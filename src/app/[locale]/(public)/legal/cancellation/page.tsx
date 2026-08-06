import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });

  return {
    title: t('cancellation.pageTitle'),
    description: t('cancellation.description'),
  };
}

export default async function CancellationPolicyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('legal');

  return (
    <>
      <h1>{t('cancellation.pageTitle')}</h1>
      <p className="lead">
        {t('cancellation.lastUpdated', { date: '2026-01-12' })}
      </p>

      <h2>{t('cancellation.sections.overview.title')}</h2>
      <p>{t('cancellation.sections.overview.content')}</p>

      <h2>{t('cancellation.sections.clientPolicy.title')}</h2>
      <p>{t('cancellation.sections.clientPolicy.content')}</p>

      <div className="my-6 rounded-xl border border-stone-200 bg-white p-6">
        <h3 className="mt-0">
          {t('cancellation.sections.clientPolicy.timeline.title')}
        </h3>
        {/* P-16 review (#120): the page used to publish a tier grid that
            never matched the code — it now mirrors the three per-winery
            policies (POLICY_TIERS, same barèmes as the CGV). */}
        <ul>
          <li>
            <strong>
              {t('cancellation.sections.clientPolicy.timeline.flexible.time')}
            </strong>
            : {t('cancellation.sections.clientPolicy.timeline.flexible.refund')}
          </li>
          <li>
            <strong>
              {t('cancellation.sections.clientPolicy.timeline.standard.time')}
            </strong>
            : {t('cancellation.sections.clientPolicy.timeline.standard.refund')}
          </li>
          <li>
            <strong>
              {t('cancellation.sections.clientPolicy.timeline.strict.time')}
            </strong>
            : {t('cancellation.sections.clientPolicy.timeline.strict.refund')}
          </li>
        </ul>
      </div>

      <h2>{t('cancellation.sections.wineryPolicy.title')}</h2>
      <p>{t('cancellation.sections.wineryPolicy.content')}</p>

      <h2>{t('cancellation.sections.noShow.title')}</h2>
      <p>{t('cancellation.sections.noShow.content')}</p>

      <h2>{t('cancellation.sections.modifications.title')}</h2>
      <p>{t('cancellation.sections.modifications.content')}</p>

      <h2>{t('cancellation.sections.refunds.title')}</h2>
      <p>{t('cancellation.sections.refunds.content')}</p>

      <h2>{t('cancellation.sections.exceptional.title')}</h2>
      <p>{t('cancellation.sections.exceptional.content')}</p>

      <h2>{t('cancellation.sections.contact.title')}</h2>
      <p>{t('cancellation.sections.contact.content')}</p>
      <p>
        <strong>EnCave SA</strong>
        <br />
        Email: support@encave.ch
      </p>
    </>
  );
}
