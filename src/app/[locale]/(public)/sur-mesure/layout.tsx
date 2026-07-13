import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import {
  getClientMessages,
  SEGMENT_EXTRA_NAMESPACES,
} from '@/lib/i18n/client-messages';

/**
 * i18n provider layer (P-06 / L-203) for /sur-mesure: the request form and
 * the offer pay button are client islands reading the `surMesure`
 * namespace, so the segment ships BASE + surMesure. Nested providers
 * REPLACE the root one, hence BASE is re-included.
 */
export default async function SurMesureSegmentLayout({
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
    SEGMENT_EXTRA_NAMESPACES.surMesure
  );

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
