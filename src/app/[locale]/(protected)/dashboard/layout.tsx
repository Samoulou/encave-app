import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { ClientDashboardSidebar } from '@/components/layout/ClientDashboardSidebar';
import { getWineryNavContext } from '@/server/queries/winery.queries';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { getPendingRequestCount } from '@/server/queries/request.queries';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // WINEMAKER: show winery dashboard sidebar
  if (session.user.role === 'WINEMAKER') {
    const [winery, tastingEnabled, requestsEnabled] = await Promise.all([
      getWineryNavContext(session.user.id),
      isFlagEnabled('TASTING_SHEET'),
      isFlagEnabled('REQUESTS'),
    ]);
    const wineryName = winery?.name ?? 'My Winery';
    // Badge count only when the flag is ON and the winery exists.
    const requestsCount =
      requestsEnabled && winery ? await getPendingRequestCount(winery.id) : 0;

    return (
      <div className="flex h-screen w-full overflow-hidden bg-primary-light">
        <DashboardSidebar
          wineryName={wineryName}
          userName={session.user.name ?? undefined}
          showWines={tastingEnabled}
          showRequests={requestsEnabled}
          requestsCount={requestsCount}
        />
        <main className="relative flex h-full flex-1 flex-col overflow-hidden md:ml-64">
          <div className="h-14 flex-shrink-0 md:hidden" />
          <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
            {children}
          </div>
        </main>
      </div>
    );
  }

  // CLIENT: show client dashboard sidebar
  if (session.user.role === 'CLIENT') {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-primary-light">
        <ClientDashboardSidebar
          userName={session.user.name ?? undefined}
          userEmail={session.user.email}
        />
        <main className="relative flex h-full flex-1 flex-col overflow-hidden md:ml-64">
          <div className="h-14 flex-shrink-0 md:hidden" />
          <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
            {children}
          </div>
        </main>
      </div>
    );
  }

  // Other roles: redirect to home
  redirect(`/${locale}`);
}
