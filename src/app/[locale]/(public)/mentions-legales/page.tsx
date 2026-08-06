import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

interface MentionsLegalesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: MentionsLegalesPageProps): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'mentionsLegales.metadata',
    path: '/mentions-legales',
  });
}

/**
 * Legal notice / Impressum (P-12 / L-114). Scaffolded: the entity identity is
 * kept as [À COMPLÉTER] i18n placeholders for Sam to fill; the sub-processors
 * (Vercel/Neon) are filled from the stack. Prose treatment mirrors /legal/*.
 */
export default async function MentionsLegalesPage({
  params,
}: MentionsLegalesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('mentionsLegales');

  const sections = [
    'editor',
    'publication',
    'contact',
    'hosting',
    'ip',
  ] as const;

  return (
    <div className="min-h-screen bg-cream-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <article className="prose prose-slate prose-headings:font-display prose-headings:text-slate-900 prose-p:text-slate-600 prose-a:text-burgundy-600 prose-a:no-underline hover:prose-a:underline max-w-none">
          <h1>{t('title')}</h1>
          <p className="lead">{t('intro')}</p>

          {sections.map((section) => (
            <section key={section}>
              <h2>{t(`${section}.title`)}</h2>
              <p className="whitespace-pre-line">{t(`${section}.body`)}</p>
            </section>
          ))}

          <section>
            <h2>{t('data.title')}</h2>
            <p className="whitespace-pre-line">{t('data.body')}</p>
            <p>
              <Link href="/legal/privacy">{t('data.privacyLink')}</Link>
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}
