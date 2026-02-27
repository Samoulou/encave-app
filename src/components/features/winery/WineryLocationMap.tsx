'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DynamicMap } from '@/components/features/map/DynamicMap';
import type { MapWinery } from '@/components/features/map/types';

interface WineryLocationMapProps {
  winery: MapWinery;
  address: string;
  commune: string;
}

export function WineryLocationMap({
  winery,
  address,
  commune,
}: WineryLocationMapProps) {
  const t = useTranslations('wineries');

  if (winery.latitude == null || winery.longitude == null) {
    return null;
  }

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${address}, ${commune}, Valais, Switzerland`)}`;

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-warm">
      <div className="p-4 pb-0">
        <h3 className="font-display text-sm font-semibold text-slate-900">
          {t('locationOnMap')}
        </h3>
      </div>
      <div className="mt-3 h-48">
        <DynamicMap
          wineries={[winery]}
          singleWinery
          className="h-full w-full rounded-none"
        />
      </div>
      <div className="p-4 pt-3">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-burgundy-600 transition-colors hover:text-burgundy-700"
        >
          {t('getDirections')}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
