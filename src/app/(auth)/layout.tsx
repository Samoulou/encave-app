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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
