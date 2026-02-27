'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTranslations } from 'next-intl';
import { Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { env } from '@/lib/env';
import type { MapWinery } from './types';

// Valais, Switzerland center
const VALAIS_CENTER: [number, number] = [7.6, 46.3];
const DEFAULT_ZOOM = 9.5;

// EnCave burgundy theme colors
const CLUSTER_COLORS = {
  small: '#962a48',
  medium: '#732040',
  large: '#450a1c',
};

interface InteractiveMapProps {
  wineries: MapWinery[];
  onWineryClick?: (_slug: string) => void;
  className?: string;
  /** Single winery mode — no clustering, centered on winery */
  singleWinery?: boolean;
}

export function InteractiveMap({
  wineries,
  onWineryClick,
  className,
  singleWinery = false,
}: InteractiveMapProps) {
  const t = useTranslations('wineries');
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapError, setMapError] = useState(false);

  const token = env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Build GeoJSON from wineries
  const geojson = useGeoJSON(wineries);

  const initMap = useCallback(() => {
    if (!mapContainer.current || !token || map.current) return;

    try {
      mapboxgl.accessToken = token;

      const firstWinery =
        singleWinery && wineries.length === 1 ? wineries[0] : undefined;
      const center: [number, number] =
        firstWinery?.longitude != null && firstWinery?.latitude != null
          ? [firstWinery.longitude, firstWinery.latitude]
          : VALAIS_CENTER;
      const zoom = singleWinery ? 13 : DEFAULT_ZOOM;

      const m = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center,
        zoom,
        minZoom: 7,
        maxZoom: 17,
        attributionControl: false,
      });

      m.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        'bottom-left'
      );
      m.addControl(new mapboxgl.NavigationControl(), 'top-right');

      m.on('load', () => {
        addSources(m, geojson, singleWinery);
        addLayers(m, singleWinery);
        addInteractions(m, onWineryClick, t, popup);
      });

      map.current = m;
    } catch {
      setMapError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, singleWinery]);

  // Initialize map
  useEffect(() => {
    initMap();
    const popupInstance = popup.current;
    const mapInstance = map.current;
    return () => {
      popupInstance?.remove();
      mapInstance?.remove();
      map.current = null;
    };
  }, [initMap]);

  // Update source data when wineries change
  useEffect(() => {
    const m = map.current;
    if (!m || !m.isStyleLoaded()) return;

    const source = m.getSource('wineries') as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData(geojson);
    }
  }, [geojson]);

  const handleLocate = useCallback(() => {
    if (!map.current || isLocating) return;
    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        map.current?.flyTo({ center: [longitude, latitude], zoom: 12 });

        new mapboxgl.Marker({ color: '#4f46e5' })
          .setLngLat([longitude, latitude])
          .addTo(map.current!);

        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [isLocating]);

  if (!token) {
    return null;
  }

  if (mapError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-stone-100 text-sm text-muted-foreground',
          className
        )}
      >
        {t('mapLoadError')}
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)}>
      <div ref={mapContainer} className="h-full w-full" />

      {/* Locate me button */}
      {!singleWinery && (
        <button
          type="button"
          onClick={handleLocate}
          disabled={isLocating}
          className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-warm transition-colors hover:bg-stone-50 disabled:opacity-60"
          aria-label={t('myLocation')}
        >
          <Navigation
            className={cn('h-4 w-4', isLocating && 'animate-pulse')}
          />
          {isLocating ? t('locating') : t('myLocation')}
        </button>
      )}
    </div>
  );
}

// --- Helpers ---

function useGeoJSON(wineries: MapWinery[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: wineries
      .filter((w) => w.latitude != null && w.longitude != null)
      .map((w) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [w.longitude!, w.latitude!],
        },
        properties: {
          id: w.id,
          name: w.name,
          slug: w.slug,
          commune: w.commune,
          coverPhoto: w.coverPhoto ?? '',
          experienceCount: w._count.experiences,
        },
      })),
  };
}

function addSources(
  m: mapboxgl.Map,
  geojson: GeoJSON.FeatureCollection,
  singleWinery: boolean
) {
  m.addSource('wineries', {
    type: 'geojson',
    data: geojson,
    ...(singleWinery
      ? {}
      : {
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        }),
  });
}

function addLayers(m: mapboxgl.Map, singleWinery: boolean) {
  if (!singleWinery) {
    // Cluster circles
    m.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'wineries',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          CLUSTER_COLORS.small,
          5,
          CLUSTER_COLORS.medium,
          15,
          CLUSTER_COLORS.large,
        ],
        'circle-radius': ['step', ['get', 'point_count'], 20, 5, 25, 15, 30],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });

    // Cluster count labels
    m.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'wineries',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 13,
      },
      paint: {
        'text-color': '#ffffff',
      },
    });
  }

  // Individual markers
  m.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'wineries',
    filter: singleWinery ? ['all'] : ['!', ['has', 'point_count']],
    paint: {
      'circle-color': CLUSTER_COLORS.small,
      'circle-radius': 8,
      'circle-stroke-width': 3,
      'circle-stroke-color': '#fff',
    },
  });
}

function addInteractions(
  m: mapboxgl.Map,
  onWineryClick: ((_slug: string) => void) | undefined,
  t: ReturnType<typeof useTranslations<'wineries'>>,
  popupRef: React.MutableRefObject<mapboxgl.Popup | null>
) {
  // Click on cluster → zoom in
  m.on('click', 'clusters', (e) => {
    const features = m.queryRenderedFeatures(e.point, {
      layers: ['clusters'],
    });
    const feature = features[0];
    if (!feature || feature.geometry.type !== 'Point') return;

    const clusterId = feature.properties?.cluster_id as number | undefined;
    const source = m.getSource('wineries') as mapboxgl.GeoJSONSource;
    if (clusterId == null) return;

    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err || zoom == null) return;
      m.easeTo({
        center: (feature.geometry as GeoJSON.Point).coordinates as [
          number,
          number,
        ],
        zoom,
      });
    });
  });

  // Click on individual marker → show popup
  m.on('click', 'unclustered-point', (e) => {
    const features = m.queryRenderedFeatures(e.point, {
      layers: ['unclustered-point'],
    });
    const feature = features[0];
    if (!feature || feature.geometry.type !== 'Point') return;

    const props = feature.properties;
    if (!props) return;

    const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [
      number,
      number,
    ];

    const name = props.name as string;
    const commune = props.commune as string;
    const slug = props.slug as string;
    const coverPhoto = props.coverPhoto as string;
    const experienceCount = props.experienceCount as number;

    const imgHtml = coverPhoto
      ? `<img src="${coverPhoto}" alt="${name}" class="h-24 w-full rounded-t-lg object-cover" />`
      : '';

    const html = `
      <div class="w-56 overflow-hidden rounded-lg bg-white shadow-lg">
        ${imgHtml}
        <div class="p-3">
          <h3 class="font-semibold text-sm text-slate-900">${name}</h3>
          <p class="mt-0.5 text-xs text-slate-500">${commune}, Valais</p>
          ${experienceCount > 0 ? `<p class="mt-1 text-xs text-burgundy-600">${t('experienceCount', { count: experienceCount })}</p>` : ''}
          <button
            data-slug="${slug}"
            class="mt-2 w-full rounded-md bg-burgundy-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-burgundy-700 transition-colors"
          >
            ${t('viewWinery')}
          </button>
        </div>
      </div>
    `;

    popupRef.current?.remove();
    const p = new mapboxgl.Popup({
      closeButton: true,
      maxWidth: '240px',
      className: 'encave-popup',
    })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(m);

    popupRef.current = p;

    // Handle "View winery" click inside popup
    const el = p.getElement();
    const btn = el?.querySelector('button[data-slug]');
    if (btn && onWineryClick) {
      btn.addEventListener('click', () => {
        onWineryClick(slug);
      });
    }
  });

  // Cursor styles
  m.on('mouseenter', 'clusters', () => {
    m.getCanvas().style.cursor = 'pointer';
  });
  m.on('mouseleave', 'clusters', () => {
    m.getCanvas().style.cursor = '';
  });
  m.on('mouseenter', 'unclustered-point', () => {
    m.getCanvas().style.cursor = 'pointer';
  });
  m.on('mouseleave', 'unclustered-point', () => {
    m.getCanvas().style.cursor = '';
  });
}
