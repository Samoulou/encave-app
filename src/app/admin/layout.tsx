import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import Link from 'next/link';
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
    redirect('/');
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
            <nav className="flex items-center gap-4">
              <Link
                href="/admin"
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-burgundy-700"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/admin/wineries/pending"
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-burgundy-700"
              >
                <Building2 className="h-4 w-4" />
                Pending Wineries
                {pendingCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-burgundy-600 px-1.5 text-xs font-medium text-white">
                    {pendingCount}
                  </span>
                )}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              {session.user.email}
            </span>
            <form action="/api/auth/signout" method="POST">
              <Button variant="outline" size="sm" type="submit">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
