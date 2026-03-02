import { Suspense } from 'react';
import {
  getVerifiedWineries,
  getDistinctCommunes,
} from '@/server/queries/winery.queries';
import { WineryCard } from '@/components/features/winery/WineryCard';
import { CommuneFilter } from '@/components/features/winery/CommuneFilter';
import { ViewToggle } from '@/components/features/winery/ViewToggle';
import { WineriesViewSwitcher } from '@/components/features/winery/WineriesViewSwitcher';
import { EmptyState } from '@/components/shared/EmptyState';
import { getTranslations } from 'next-intl/server';
import type { MapWinery } from '@/components/features/map/types';

interface WineriesContentProps {
  commune?: string;
}

/**
 * Async server component that fetches winery data.
 * Designed to be wrapped in Suspense for streaming/progressive loading.
 */
export async function WineriesContent({ commune }: WineriesContentProps) {
  const [wineries, communes, t] = await Promise.all([
    getVerifiedWineries(commune),
    getDistinctCommunes(),
    getTranslations('wineries'),
  ]);

  // Extract minimal data for the map (avoids sending full Prisma objects to client)
  const mapWineries: MapWinery[] = wineries.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    commune: w.commune,
    coverPhoto: w.coverPhoto,
    latitude: w.latitude,
    longitude: w.longitude,
    _count: w._count,
  }));

  const gridContent = (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
      {wineries.length === 0 ? (
        <EmptyState
          title={t('comingSoon')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {wineries.map((winery, index) => (
            <div
              key={winery.id}
              className="animate-in fade-in slide-in-from-bottom-4"
              style={{
                animationDelay: `${index * 100}ms`,
                animationFillMode: 'both',
              }}
            >
              <WineryCard winery={winery} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Filter Bar */}
      <div className="sticky top-0 z-20 border-b border-stone-200/60 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <span className="text-sm font-medium text-slate-600">
            {t('showingCount', { count: wineries.length })}
          </span>
          <div className="flex items-center gap-3">
            <ViewToggle />
            {communes.length > 0 && (
              <Suspense
                fallback={
                  <div className="skeleton-warm h-11 w-[200px] animate-skeleton-shimmer rounded-lg" />
                }
              >
                <CommuneFilter communes={communes} />
              </Suspense>
            )}
          </div>
        </div>
      </div>

      {/* View Content */}
      <WineriesViewSwitcher wineries={mapWineries} gridContent={gridContent} />
    </>
  );
}
