import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import {
  getClientMessages,
  SEGMENT_EXTRA_NAMESPACES,
} from '@/lib/i18n/client-messages';

/**
 * i18n provider layer (P-06 / L-203) for /contact: the contact form is a
 * client island reading `contact.form`, so the segment ships BASE +
 * contact.form. Nested providers REPLACE the root one, hence BASE is
 * re-included. Without this layer the form rendered raw message keys.
 */
export default async function ContactSegmentLayout({
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
    SEGMENT_EXTRA_NAMESPACES.contact
  );

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
