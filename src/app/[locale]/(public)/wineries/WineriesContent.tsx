import { Suspense } from 'react';
import {
  getVerifiedWineries,
  getDistinctCommunes,
} from '@/server/queries/winery.queries';
import { WineryCard } from '@/components/features/winery/WineryCard';
import { CommuneFilter } from '@/components/features/winery/CommuneFilter';
import { EmptyState } from '@/components/shared/EmptyState';
import { getTranslations } from 'next-intl/server';

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

  return (
    <>
      {/* Filter Bar */}
      <div className="sticky top-0 z-20 border-b border-stone-200/60 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4 lg:px-8">
          <span className="text-sm font-medium text-slate-600">
            {t('showingCount', { count: wineries.length })}
          </span>
          {communes.length > 0 && (
            <Suspense fallback={<div className="h-11 w-[200px] skeleton-warm rounded-lg animate-skeleton-shimmer" />}>
              <CommuneFilter communes={communes} />
            </Suspense>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 lg:px-8 lg:py-12">
        {wineries.length === 0 ? (
          <EmptyState
            title={t('comingSoon')}
            description={t('emptyDescription')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {wineries.map((winery, index) => (
              <div
                key={winery.id}
                className="animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
              >
                <WineryCard winery={winery} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
