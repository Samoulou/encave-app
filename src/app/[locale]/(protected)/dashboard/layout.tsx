import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { getWineryByUserId } from '@/server/queries/winery.queries';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const locale = await getLocale();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // Only winemakers should access the dashboard
  if (session.user.role !== 'WINEMAKER') {
    redirect(`/${locale}`);
  }

  const winery = await getWineryByUserId(session.user.id);
  const wineryName = winery?.name ?? 'My Winery';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f8f6f6]">
      <DashboardSidebar
        wineryName={wineryName}
        userName={session.user.name ?? undefined}
      />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative md:ml-64">
        {/* Mobile spacer for fixed header */}
        <div className="md:hidden h-14 flex-shrink-0" />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
}
