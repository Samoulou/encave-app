import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import {
  getClientMessages,
  SEGMENT_EXTRA_NAMESPACES,
} from '@/lib/i18n/client-messages';

/** i18n provider layer (P-06 / L-203) — see experiences/layout.tsx. */
export default async function WineriesSegmentLayout({
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
    SEGMENT_EXTRA_NAMESPACES.wineries
  );

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
