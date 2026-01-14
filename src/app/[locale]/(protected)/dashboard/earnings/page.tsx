import type { Metadata } from 'next';
import { Suspense } from 'react';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { ExportEarningsButton } from '@/components/features/earnings';
import { Skeleton } from '@/components/shared/Skeleton';
import { EarningsContent } from './EarningsContent';

export const metadata: Metadata = {
  title: 'Earnings | EnCave Dashboard',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    month?: string;
    experience?: string;
    status?: string;
  }>;
}

export default async function EarningsPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;

  // Get winery for the user - needed for auth check and Stripe status
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true, stripeOnboardingComplete: true },
  });

  if (!winery) {
    redirect('/onboarding/winery');
  }

  return (
    <WineryAccessGuard>
      <div className="space-y-8">
        {/* Page Header - renders immediately */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-display-md text-slate-900">
              Earnings
            </h1>
            <p className="text-slate-600">
              Track your revenue and payouts from the platform
            </p>
          </div>
          <ExportEarningsButton />
        </div>

        {/* Stripe Onboarding Warning - renders immediately */}
        {!winery.stripeOnboardingComplete && (
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-4 border border-amber-200">
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

        {/* Content streams in when data is ready */}
        <Suspense fallback={<EarningsLoadingState />}>
          <EarningsContent wineryId={winery.id} params={params} />
        </Suspense>
      </div>
    </WineryAccessGuard>
  );
}

function EarningsLoadingState() {
  return (
    <>
      {/* Summary Cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white p-6 shadow-warm">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>

      {/* Chart and YTD skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-warm">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="rounded-xl bg-white p-6 shadow-warm">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payout info skeleton */}
      <div className="rounded-xl bg-white p-6 shadow-warm">
        <Skeleton className="h-5 w-40 mb-2" />
        <Skeleton className="h-4 w-full" />
      </div>

      {/* Transactions skeleton */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-4 w-32" />
        <div className="rounded-xl bg-white shadow-warm overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 border-b border-stone-100 flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
