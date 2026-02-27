'use client';

import { type ReactNode } from 'react';
import { useViewMode } from './ViewToggle';
import { WineriesMapView } from './WineriesMapView';
import type { MapWinery } from '@/components/features/map/types';

interface WineriesViewSwitcherProps {
  wineries: MapWinery[];
  /** Grid view content rendered by server component */
  gridContent: ReactNode;
}

export function WineriesViewSwitcher({
  wineries,
  gridContent,
}: WineriesViewSwitcherProps) {
  const view = useViewMode();

  if (view === 'map') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <WineriesMapView wineries={wineries} />
      </div>
    );
  }

  return <>{gridContent}</>;
}
