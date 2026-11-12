import { useTranslations } from 'next-intl';
import { WineryCard } from '@/components/features/winery/WineryCard';
import type { WineryCardDTO } from '@/components/features/winery/WineriesExplorer';

/**
 * Server-rendered grid used as the Suspense FALLBACK of WineriesExplorer.
 * The explorer reads the URL through nuqs (commune filter, grid/map view),
 * which bails out to client rendering on this ISR page — the fallback is
 * what the prerendered HTML carries: real cards and links instead of
 * skeletons.
 */
export function WineriesStaticFallback({
  wineries,
}: {
  wineries: WineryCardDTO[];
}) {
  const t = useTranslations('wineries');

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-stone-200/60 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <h2 className="text-sm font-medium text-slate-600">
            {t('showingCount', { count: wineries.length })}
          </h2>
          <div className="h-11" aria-hidden="true" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {wineries.map((winery) => (
            <WineryCard key={winery.id} winery={winery} />
          ))}
        </div>
      </div>
    </>
  );
}
