import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirect to home if already logged in
  if (session?.user) {
    redirect('/');
  }

  return <>{children}</>;
}
