'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import { DynamicMap } from '@/components/features/map/DynamicMap';
import { useNavigateWithTransition } from '@/hooks/useNavigateWithTransition';
import type { MapWinery } from '@/components/features/map/types';

interface WineriesMapViewProps {
  wineries: MapWinery[];
}

export function WineriesMapView({ wineries }: WineriesMapViewProps) {
  const locale = useLocale();
  const { navigate } = useNavigateWithTransition();

  const handleWineryClick = useCallback(
    (slug: string) => {
      navigate(`/${locale}/wineries/${slug}`);
    },
    [navigate, locale]
  );

  return (
    <DynamicMap
      wineries={wineries}
      onWineryClick={handleWineryClick}
      className="h-[500px] sm:h-[600px] lg:h-[700px]"
    />
  );
}
