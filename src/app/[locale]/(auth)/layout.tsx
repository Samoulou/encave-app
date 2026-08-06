import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import {
  getClientMessages,
  SEGMENT_EXTRA_NAMESPACES,
} from '@/lib/i18n/client-messages';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const locale = await getLocale();

  // Redirect to home if already logged in
  if (session?.user) {
    redirect(`/${locale}`);
  }

  // i18n provider layer (P-06 / L-203): the login/register forms need
  // the 'auth' namespace — served here instead of taxing every public
  // page's BASE payload.
  const messages = await getClientMessages(
    locale,
    SEGMENT_EXTRA_NAMESPACES.auth
  );

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
