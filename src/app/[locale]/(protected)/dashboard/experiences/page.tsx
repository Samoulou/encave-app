import type { Metadata } from 'next';
import { Suspense } from 'react';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/shared/Skeleton';
import { Plus } from 'lucide-react';
import { ExperiencesContent } from './ExperiencesContent';

export const metadata: Metadata = {
  title: 'Experiences | EnCave Dashboard',
  robots: { index: false, follow: false },
};

type SortOption = 'newest' | 'oldest' | 'alphabetical' | 'status';

interface PageProps {
  searchParams: Promise<{ sort?: string }>;
}

export default async function ExperiencesDashboardPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;
  const sort = (params.sort as SortOption) || 'newest';

  // Get winery ID for auth check only
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!winery) {
    redirect('/onboarding/winery');
  }

  return (
    <WineryAccessGuard>
      <div className="container max-w-6xl py-12">
        {/* Page Header - renders immediately */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-display-md text-slate-900">
              Your Experiences
            </h1>
            <p className="text-slate-600">
              Create and manage wine experiences for visitors to book
            </p>
          </div>
          <Button asChild size="lg" className="gap-2">
            <Link href="/dashboard/experiences/new">
              <Plus className="h-5 w-5" />
              Create Experience
            </Link>
          </Button>
        </div>

        {/* Content streams in when data is ready */}
        <Suspense fallback={<ExperiencesLoadingState />}>
          <ExperiencesContent wineryId={winery.id} sort={sort} />
        </Suspense>
      </div>
    </WineryAccessGuard>
  );
}

function ExperiencesLoadingState() {
  return (
    <>
      {/* Sort Controls skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Experience cards skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white p-4 shadow-warm flex gap-4">
            <Skeleton className="h-24 w-32 rounded-lg shrink-0" />
            <div className="flex-1 py-1">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-32 mb-3" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
