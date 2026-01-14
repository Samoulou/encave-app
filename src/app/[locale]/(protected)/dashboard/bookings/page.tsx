import type { Metadata } from 'next';
import { Suspense } from 'react';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';
import { BookingsSummary } from './BookingsSummary';
import { BookingsFiltersSection } from './BookingsFiltersSection';
import { BookingsTableSection } from './BookingsTableSection';

export const metadata: Metadata = {
  title: 'Bookings | EnCave Dashboard',
  robots: { index: false, follow: false },
};

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
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;

  // Get winery for the user - needed for auth check
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!winery) {
    redirect('/onboarding/winery');
  }

  return (
    <WineryAccessGuard>
      <div className="space-y-8">
        {/* Page Header - renders immediately */}
        <div className="space-y-2">
          <h1 className="font-display text-display-md text-slate-900">
            Bookings
          </h1>
          <p className="text-slate-600">
            Manage reservations and track your upcoming visits
          </p>
        </div>

        {/* Stream 1: Summary Cards (fast query) */}
        <Suspense fallback={<SummaryCardsSkeleton />}>
          <BookingsSummary wineryId={winery.id} />
        </Suspense>

        {/* Stream 2: Filters Section (medium query) */}
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

/** Skeleton for summary cards - matches BookingSummaryCards layout */
function SummaryCardsSkeleton() {
  return (
    <SkeletonContainer label="Loading summary..." className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-white p-6 shadow-warm">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </SkeletonContainer>
  );
}

/** Skeleton for filters section - matches BookingFilters layout */
function FiltersSkeleton() {
  return (
    <SkeletonContainer label="Loading filters..." className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>
    </SkeletonContainer>
  );
}

/** Skeleton for bookings table - matches BookingsTable layout */
function TableSkeleton() {
  return (
    <SkeletonContainer label="Loading bookings..." className="space-y-4">
      <Skeleton className="h-5 w-32" />
      <div className="rounded-xl bg-white shadow-warm overflow-hidden">
        <div className="p-4 border-b border-stone-100">
          <Skeleton className="h-5 w-48" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 border-b border-stone-100 flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-48 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}
