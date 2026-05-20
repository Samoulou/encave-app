import { auth, isCurrentUserSuspended } from '@/server/auth';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

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

  return <>{children}</>;
}
