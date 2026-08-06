import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';
import { ContactForm } from './ContactForm';

interface ContactPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: ContactPageProps): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'contact.metadata',
    path: '/contact',
  });
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact');

  return (
    <div className="min-h-screen bg-cream-50">
      <Header />
      <main
        id="main-content"
        className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20"
      >
        <div className="mb-10 text-center">
          <h1 className="font-display text-4xl font-semibold text-ink-900 sm:text-5xl">
            {t('hero.title')}
          </h1>
          <p className="text-ink-600 mx-auto mt-4 max-w-xl text-lg">
            {t('hero.subtitle')}
          </p>
          <a
            href="mailto:samuel@encave.ch"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-burgundy-700 transition-colors hover:text-burgundy-800"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            samuel@encave.ch
          </a>
        </div>

        <ContactForm />
      </main>
      <Footer />
    </div>
  );
}
