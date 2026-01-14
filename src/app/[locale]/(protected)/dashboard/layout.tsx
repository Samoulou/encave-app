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
    <div className="min-h-screen bg-cream-50">
      <DashboardSidebar wineryName={wineryName} />
      <main className="md:ml-64 min-h-screen">
        <div className="px-6 py-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
