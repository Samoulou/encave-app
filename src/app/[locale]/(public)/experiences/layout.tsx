import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import {
  getClientMessages,
  SEGMENT_EXTRA_NAMESPACES,
} from '@/lib/i18n/client-messages';

/**
 * i18n provider layer (P-06 / L-203): the experiences tree (catalogue,
 * fiche, /book, checkout) has the largest client surface — its islands
 * get BASE + the experience/booking/checkout namespaces. Nested
 * providers REPLACE the root one, hence BASE is re-included.
 */
export default async function ExperiencesSegmentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getClientMessages(
    locale,
    SEGMENT_EXTRA_NAMESPACES.experiences
  );

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
