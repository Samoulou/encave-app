'use client';

import { Suspense, useMemo } from 'react';
import { useQueryState } from 'nuqs';
import { useTranslations } from 'next-intl';
import { WineryCard } from '@/components/features/winery/WineryCard';
import { CommuneFilter } from '@/components/features/winery/CommuneFilter';
import {
  ViewToggle,
  useViewMode,
} from '@/components/features/winery/ViewToggle';
import { WineriesMapView } from '@/components/features/winery/WineriesMapView';
import { EmptyState } from '@/components/shared/EmptyState';
import type { MapWinery } from '@/components/features/map/types';

export interface WineryCardDTO {
  id: string;
  slug: string;
  name: string;
  commune: string;
  description: string;
  coverPhoto: string | null;
  status: string;
}

interface WineriesExplorerProps {
  wineries: WineryCardDTO[];
  mapWineries: MapWinery[];
  communes: string[];
}

/**
 * Client explorer of the wineries list (P-06 / D2): the page is ISR and
 * always ships the FULL visible list (small dataset by design — Valais
 * launch); the commune filter and the grid/map toggle are pure client
 * state (nuqs, shallow — no server navigation). Grid, map and count all
 * derive from the same filtered list.
 */
export function WineriesExplorer({
  wineries,
  mapWineries,
  communes,
}: WineriesExplorerProps) {
  const t = useTranslations('wineries');
  const [commune] = useQueryState('commune');
  const view = useViewMode();

  const filtered = useMemo(
    () => (commune ? wineries.filter((w) => w.commune === commune) : wineries),
    [wineries, commune]
  );
  const filteredMap = useMemo(
    () =>
      commune ? mapWineries.filter((w) => w.commune === commune) : mapWineries,
    [mapWineries, commune]
  );

  return (
    <>
      {/* Filter Bar */}
      <div className="sticky top-0 z-20 border-b border-stone-200/60 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <span className="text-sm font-medium text-slate-600">
            {t('showingCount', { count: filtered.length })}
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
      {view === 'map' ? (
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <WineriesMapView wineries={filteredMap} />
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          {filtered.length === 0 ? (
            <EmptyState
              title={t('comingSoon')}
              description={t('emptyDescription')}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
              {filtered.map((winery, index) => (
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
      )}
    </>
  );
}
