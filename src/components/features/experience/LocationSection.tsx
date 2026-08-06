'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DynamicMap } from '@/components/features/map/DynamicMap';
import { LazyOnVisible } from '@/components/shared/LazyOnVisible';
import { Skeleton } from '@/components/shared/Skeleton';
import type { MapWinery } from '@/components/features/map/types';

interface LocationSectionProps {
  address: string;
  commune: string;
  wineryName: string;
  winerySlug: string;
  latitude?: number | null;
  longitude?: number | null;
}

export function LocationSection({
  address,
  commune,
  wineryName,
  winerySlug,
  latitude,
  longitude,
}: LocationSectionProps) {
  const t = useTranslations('experience');
  const tMap = useTranslations('wineries');

  const fullAddress = `${address}, ${commune}, Valais, Switzerland`;
  const hasCoordinates = latitude != null && longitude != null;

  const directionsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  const mapWinery: MapWinery = {
    id: winerySlug,
    name: wineryName,
    slug: winerySlug,
    commune,
    coverPhoto: null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    _count: { experiences: 0 },
  };

  return (
    <section data-testid="location-section">
      <h3 className="mb-4 text-2xl font-bold text-foreground">
        {t('whereYoullBe')}
      </h3>
      <p className="mb-4 text-muted-foreground" data-testid="winery-address">
        {fullAddress}
      </p>

      {/* Map */}
      {hasCoordinates ? (
        <div className="overflow-hidden rounded-xl shadow-sm">
          {/* Below the fold on mobile — the maplibre chunk only loads
              when the visitor scrolls near the map (P-06 / L-201). */}
          <LazyOnVisible fallback={<Skeleton className="h-80 w-full" />}>
            <DynamicMap
              wineries={[mapWinery]}
              singleWinery
              className="h-80 w-full"
            />
          </LazyOnVisible>
          <div className="flex items-center justify-between bg-white px-4 py-3">
            <span className="text-sm text-muted-foreground">{wineryName}</span>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-burgundy-600 transition-colors hover:text-burgundy-700"
            >
              {tMap('getDirections')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="flex h-80 items-center justify-center rounded-xl bg-stone-100 text-sm text-muted-foreground">
          {tMap('mapLoadError')}
        </div>
      )}
    </section>
  );
}
