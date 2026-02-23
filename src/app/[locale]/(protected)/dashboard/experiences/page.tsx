import { Suspense } from 'react';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/shared/Skeleton';
import { Plus } from 'lucide-react';
import { ExperiencesContent } from './ExperiencesContent';
import type { FilterStatus } from '@/components/features/experience/ExperienceFilters';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.dashboard.experiences',
    noIndex: true,
  });
}

interface PageProps {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
}

export default async function ExperiencesDashboardPage({ searchParams }: PageProps) {
  // Parallelize auth and searchParams - they don't depend on each other
  const [session, params] = await Promise.all([auth(), searchParams]);

  if (!session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  const filter = (params.filter as FilterStatus) || 'all';
  const search = params.q || '';
  const page = Math.max(1, parseInt(params.page || '1', 10));

  // Get winery ID for auth check only - needs session.user.id
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!winery) {
    const locale = await getLocale();
    redirect(`/${locale}/onboarding/winery`);
  }

  const t = await getTranslations('experience');

  return (
    <WineryAccessGuard>
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-black tracking-[-0.033em] text-foreground">
              {t('manageTitle')}
            </h1>
            <p className="text-gray-500 mt-1">
              {t('manageSubtitle')}
            </p>
          </div>
          <Button
            asChild
            className="flex items-center gap-2 bg-primary hover:bg-[hsl(var(--primary-hover))] text-white px-5 py-2.5 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-95 group"
          >
            <Link href="/dashboard/experiences/new">
              <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
              <span className="font-bold text-sm">{t('newExperience')}</span>
            </Link>
          </Button>
        </div>

        {/* Content streams in when data is ready */}
        <Suspense fallback={<ExperiencesLoadingState />}>
          <ExperiencesContent
            wineryId={winery.id}
            filter={filter}
            search={search}
            page={page}
          />
        </Suspense>
      </div>
    </WineryAccessGuard>
  );
}

function ExperiencesLoadingState() {
  return (
    <div className="flex flex-col gap-8">
      {/* Filters skeleton */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-2 rounded-xl shadow-sm border border-[#e5dbdd]/50">
        <Skeleton className="h-12 w-full lg:max-w-md" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>

      {/* Experience cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white overflow-hidden shadow-card">
            <Skeleton className="aspect-[3/2] w-full" />
            <div className="p-5 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="pt-4 border-t border-gray-100 flex justify-between">
                <Skeleton className="h-6 w-24" />
                <div className="flex gap-1">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
