import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirect to home if already logged in
  if (session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}`);
  }

  return <>{children}</>;
}
