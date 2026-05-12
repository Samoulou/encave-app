import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { db } from '@/server/db';
import { Home, Building2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

async function getPendingCount() {
  return db.winery.count({
    where: { status: 'PENDING' },
  });
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== 'ADMIN') {
    const locale = await getLocale();
    redirect(`/${locale}`);
  }

  const pendingCount = await getPendingCount();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="text-xl font-bold text-burgundy-700">
              EnCave Admin
            </Link>
            <nav
              aria-label="Admin navigation"
              className="flex items-center gap-4"
            >
              <Link
                href="/admin"
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-burgundy-700"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Dashboard
              </Link>
              <Link
                href="/admin/wineries/pending"
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-burgundy-700"
              >
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Pending Wineries
                {pendingCount > 0 && (
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full bg-burgundy-600 px-1.5 text-xs font-medium text-white"
                    aria-label={`${pendingCount} pending`}
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{session.user.email}</span>
            <form action="/api/auth/signout" method="POST">
              <Button variant="outline" size="sm" type="submit">
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main id="main-content">{children}</main>
    </div>
  );
}
