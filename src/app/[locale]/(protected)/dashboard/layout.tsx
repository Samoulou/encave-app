import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { ClientDashboardSidebar } from '@/components/layout/ClientDashboardSidebar';
import { getWineryByUserId } from '@/server/queries/winery.queries';

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
    const winery = await getWineryByUserId(session.user.id);
    const wineryName = winery?.name ?? 'My Winery';

    return (
      <div className="flex h-screen w-full overflow-hidden bg-[#f8f6f6]">
        <DashboardSidebar
          wineryName={wineryName}
          userName={session.user.name ?? undefined}
        />
        <main className="flex-1 flex flex-col h-full overflow-hidden relative md:ml-64">
          <div className="md:hidden h-14 flex-shrink-0" />
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
      <div className="flex h-screen w-full overflow-hidden bg-[#f8f6f6]">
        <ClientDashboardSidebar
          userName={session.user.name ?? undefined}
          userEmail={session.user.email}
        />
        <main className="flex-1 flex flex-col h-full overflow-hidden relative md:ml-64">
          <div className="md:hidden h-14 flex-shrink-0" />
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
