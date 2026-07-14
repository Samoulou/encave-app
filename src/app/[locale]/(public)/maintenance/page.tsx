import type { Metadata } from 'next';
import Image from 'next/image';
import { Wine } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

interface MaintenancePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: MaintenancePageProps): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'maintenance.metadata',
    noIndex: true,
  });
}

/**
 * Static maintenance page (P-12 / L-114) — no data, ready for the
 * 5–15 Dec Maldives freeze. Middleware gating stays a freeze-time toggle.
 */
export default async function MaintenancePage({
  params,
}: MaintenancePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('maintenance');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-cream-50 via-cream-100 to-burgundy-50 px-6 text-center">
      <Image
        src="/icons/encave-logo.png"
        alt="EnCave"
        width={240}
        height={68}
        className="mb-10 h-16 w-auto"
        priority
      />
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-burgundy-100">
        <Wine className="h-8 w-8 text-burgundy-600" aria-hidden="true" />
      </div>
      <h1 className="font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
        {t('title')}
      </h1>
      <p className="text-ink-600 mt-4 max-w-md text-lg">{t('message')}</p>
      <a
        href="mailto:samuel@encave.ch"
        className="mt-8 text-sm font-medium text-burgundy-700 transition-colors hover:text-burgundy-800"
      >
        samuel@encave.ch
      </a>
    </main>
  );
}
