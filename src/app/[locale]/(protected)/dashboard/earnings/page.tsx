import { Suspense } from 'react';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { AlertTriangle } from 'lucide-react';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { EarningsPageHeader } from '@/components/features/earnings/EarningsPageHeader';
import { Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';
import { EarningsSummary } from './EarningsSummary';
import { EarningsChartsSection } from './EarningsChartsSection';
import { EarningsTransactionsSection } from './EarningsTransactionsSection';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.dashboard.earnings',
    noIndex: true,
  });
}

interface PageProps {
  searchParams: Promise<{
    month?: string;
    experience?: string;
    status?: string;
  }>;
}

export default async function EarningsPage({ searchParams }: PageProps) {
  // Parallelize auth and searchParams - they don't depend on each other
  const [session, params] = await Promise.all([auth(), searchParams]);

  if (!session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  // Get winery for the user - needs session.user.id
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true, stripeOnboardingComplete: true },
  });

  if (!winery) {
    const locale = await getLocale();
    redirect(`/${locale}/onboarding/winery`);
  }

  return (
    <WineryAccessGuard>
      <div className="space-y-8">
        {/* Page Header - renders immediately */}
        <EarningsPageHeader />

        {/* Stripe Onboarding Warning - renders immediately */}
        {!winery.stripeOnboardingComplete && (
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 border border-amber-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900">
              <p className="font-medium">Complete Stripe Setup</p>
              <p className="mt-1 text-amber-700">
                To receive payouts, you need to complete your Stripe account setup.
                Go to your{' '}
                <a href="/dashboard/winery/profile" className="underline">
                  Winery Profile
                </a>{' '}
                to complete the process.
              </p>
            </div>
          </div>
        )}

        {/* Stream 1: Summary Cards (fast query) - 3 KPI cards matching mockup */}
        <Suspense fallback={<SummarySkeleton />}>
          <EarningsSummary wineryId={winery.id} />
        </Suspense>

        {/* Stream 2: Chart Section (medium query) - Revenue Evolution chart */}
        <Suspense fallback={<ChartsSkeleton />}>
          <EarningsChartsSection wineryId={winery.id} />
        </Suspense>

        {/* Stream 3: Transactions (heavier query) */}
        <Suspense fallback={<TransactionsSkeleton />}>
          <EarningsTransactionsSection wineryId={winery.id} params={params} />
        </Suspense>
      </div>
    </WineryAccessGuard>
  );
}

/** Skeleton for summary cards - matches mockup 3-card layout */
function SummarySkeleton() {
  return (
    <SkeletonContainer label="Loading summary..." className="grid gap-4 grid-cols-1 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[#e5d2d7] bg-white p-6 shadow-sm h-40">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
          <div className="mt-4">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-4 w-24 mt-2" />
          </div>
        </div>
      ))}
    </SkeletonContainer>
  );
}

/** Skeleton for chart section - matches Revenue Evolution chart */
function ChartsSkeleton() {
  return (
    <SkeletonContainer label="Loading chart...">
      <div className="rounded-xl border border-[#e5d2d7] bg-white p-6 lg:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <Skeleton className="h-[320px] w-full" />
      </div>
    </SkeletonContainer>
  );
}

/** Skeleton for transactions section - matches mockup table layout */
function TransactionsSkeleton() {
  return (
    <SkeletonContainer label="Loading transactions..." className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="rounded-xl border border-[#e5d2d7] bg-white shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="border-b border-[#e5d2d7] bg-gray-50 px-6 py-4">
          <div className="grid grid-cols-7 gap-4">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-4" />
          </div>
        </div>
        {/* Table Rows */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-6 py-4 border-b border-[#f2e9eb]">
            <div className="grid grid-cols-7 gap-4 items-center">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}
