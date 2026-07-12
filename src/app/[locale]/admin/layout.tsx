import { auth, isCurrentUserSuspended } from '@/server/auth';
import { notFound, redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { db } from '@/server/db';
import {
  Home,
  Building2,
  CalendarDays,
  ClipboardList,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
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

  if (!session?.user) {
    // Expired-cookie case (the middleware only covers absent cookies):
    // keep the pre-P-06 behavior of returning the admin to their
    // section after re-login.
    const locale = await getLocale();
    redirect(`/${locale}/login?callbackUrl=/${locale}/admin`);
  }

  // Sole role gate since P-06 removed the middleware fetch: a logged-in
  // non-admin gets the same 404 the middleware used to rewrite to.
  if (session.user.role !== 'ADMIN') {
    notFound();
  }

  if (await isCurrentUserSuspended()) {
    const locale = await getLocale();
    redirect(`/${locale}`);
  }

  const pendingCount = await getPendingCount();

  // P-06 (L-203): full messages for the admin client surface — the root
  // layout only carries the public subset now.
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="min-h-screen bg-muted">
        <header className="border-b bg-white">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link
                href="/admin"
                className="text-xl font-bold text-burgundy-700"
              >
                EnCave Admin
              </Link>
              <nav
                aria-label="Admin navigation"
                className="flex items-center gap-4"
              >
                <Link
                  href="/admin"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-burgundy-700"
                >
                  <Home className="h-4 w-4" aria-hidden="true" />
                  Dashboard
                </Link>
                <Link
                  href="/admin/wineries/pending"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-burgundy-700"
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
                <Link
                  href="/admin/events"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-burgundy-700"
                >
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Events
                </Link>
                <Link
                  href="/admin/bookings"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-burgundy-700"
                >
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Bookings
                </Link>
                <Link
                  href="/admin/compliance"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-burgundy-700"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Compliance
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {session.user.email}
              </span>
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
    </NextIntlClientProvider>
  );
}
