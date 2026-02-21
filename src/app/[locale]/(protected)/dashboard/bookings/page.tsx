import { Suspense } from 'react';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';
import { BookingsSummary } from './BookingsSummary';
import { BookingsFiltersSection } from './BookingsFiltersSection';
import { BookingsTableSection } from './BookingsTableSection';
import { BookingsPageHeader } from './BookingsPageHeader';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    path: '/dashboard/bookings',
    namespace: 'metadata.dashboard.bookings',
    noIndex: true,
  });
}

interface PageProps {
  searchParams: Promise<{
    status?: string;
    experience?: string;
    from?: string;
    to?: string;
    search?: string;
    sort?: string;
    order?: string;
    view?: string;
    month?: string;
  }>;
}

export default async function BookingsDashboardPage({ searchParams }: PageProps) {
  // Parallelize auth and searchParams - they don't depend on each other
  const [session, params] = await Promise.all([auth(), searchParams]);

  if (!session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  // Get winery for the user - needs session.user.id
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!winery) {
    const locale = await getLocale();
    redirect(`/${locale}/onboarding/winery`);
  }

  return (
    <WineryAccessGuard>
      <div className="space-y-6">
        {/* Page Header with Actions */}
        <BookingsPageHeader />

        {/* Stream 1: KPI Cards (fast query) */}
        <Suspense fallback={<SummaryCardsSkeleton />}>
          <BookingsSummary wineryId={winery.id} />
        </Suspense>

        {/* Stream 2: Filters & Table (combined for better UX) */}
        <Suspense fallback={<FiltersSkeleton />}>
          <BookingsFiltersSection wineryId={winery.id} />
        </Suspense>

        {/* Stream 3: Table/Calendar (heavier query) */}
        <Suspense fallback={<TableSkeleton />}>
          <BookingsTableSection wineryId={winery.id} params={params} />
        </Suspense>
      </div>
    </WineryAccessGuard>
  );
}

/** Skeleton for KPI cards - matches BookingSummaryCards layout (3 cards) */
function SummaryCardsSkeleton() {
  return (
    <SkeletonContainer label="Loading summary..." className="grid gap-4 grid-cols-1 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[#e5d2d7] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-6" />
          </div>
          <div className="mt-3">
            <Skeleton className="h-9 w-16" />
          </div>
        </div>
      ))}
    </SkeletonContainer>
  );
}

/** Skeleton for filters toolbar */
function FiltersSkeleton() {
  return (
    <SkeletonContainer
      label="Loading filters..."
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e5d2d7] bg-white p-2"
    >
      <div className="flex items-center gap-2 flex-1 min-w-[300px]">
        <Skeleton className="h-10 flex-1 max-w-md rounded-lg" />
        <Skeleton className="h-10 w-20 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-48 rounded-lg" />
    </SkeletonContainer>
  );
}

/** Skeleton for bookings table - matches mockup layout */
function TableSkeleton() {
  return (
    <SkeletonContainer label="Loading bookings..." className="space-y-4">
      <div className="rounded-xl border border-[#e5d2d7] bg-white shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="border-b border-[#e5d2d7] px-6 py-4">
          <div className="grid grid-cols-6 gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        {/* Table Rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-6 py-4 border-b border-[#f2e9eb]">
            <div className="grid grid-cols-6 gap-4 items-center">
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-28 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
        {/* Pagination Footer */}
        <div className="px-6 py-4 border-t border-[#e5d2d7] flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </div>
      </div>
    </SkeletonContainer>
  );
}
