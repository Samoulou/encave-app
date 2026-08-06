import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import {
  getClientMessages,
  SEGMENT_EXTRA_NAMESPACES,
} from '@/lib/i18n/client-messages';

/**
 * i18n provider layer (P-06 / L-203) for /bon/[code]: the public gift view
 * is server-rendered but shares the `giftCards` namespace; the segment
 * ships BASE + giftCards so any client island resolves its keys. Nested
 * providers REPLACE the root one, hence BASE is re-included.
 */
export default async function BonSegmentLayout({
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
    SEGMENT_EXTRA_NAMESPACES.bon
  );

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
