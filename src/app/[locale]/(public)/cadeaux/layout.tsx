import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import {
  getClientMessages,
  SEGMENT_EXTRA_NAMESPACES,
} from '@/lib/i18n/client-messages';

/**
 * i18n provider layer (P-06 / L-203) for /cadeaux: the gift configurator
 * is a client island reading the `giftCards` namespace, so the segment
 * ships BASE + giftCards. Nested providers REPLACE the root one, hence
 * BASE is re-included.
 */
export default async function CadeauxSegmentLayout({
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
    SEGMENT_EXTRA_NAMESPACES.cadeaux
  );

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
