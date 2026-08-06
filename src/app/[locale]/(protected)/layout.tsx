import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { auth, isCurrentUserSuspended } from '@/server/auth';
import { redirect } from 'next/navigation';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  if (await isCurrentUserSuspended()) {
    const locale = await getLocale();
    redirect(`/${locale}`);
  }

  // P-06 (L-203): the root layout only serializes the public subset —
  // the dashboard's client surface needs the full messages. These routes
  // are dynamic anyway (auth()), so the payload cost stays private.
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
