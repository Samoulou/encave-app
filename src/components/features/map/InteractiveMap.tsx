'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTranslations } from 'next-intl';
import { MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapWinery } from './types';

// Valais, Switzerland center
const VALAIS_CENTER: [number, number] = [7.6, 46.3];
const DEFAULT_ZOOM = 9.5;

const OSM_STYLE: mapboxgl.Style = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

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

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Build GeoJSON from wineries
  const geojson = useGeoJSON(wineries);

  const initMap = useCallback(() => {
    if (!mapContainer.current || map.current) return;

    try {
      if (token) {
        mapboxgl.accessToken = token;
      }

      const firstWinery =
        singleWinery && wineries.length === 1 ? wineries[0] : undefined;
      const center: [number, number] =
        firstWinery?.longitude != null && firstWinery?.latitude != null
          ? [firstWinery.longitude, firstWinery.latitude]
          : VALAIS_CENTER;
      const zoom = singleWinery ? 13 : DEFAULT_ZOOM;

      const m = new mapboxgl.Map({
        container: mapContainer.current,
        style: token ? 'mapbox://styles/mapbox/light-v11' : OSM_STYLE,
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

  if (mapError) {
    return <MapFallback className={className} message={t('mapLoadError')} />;
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

function StaticMapFallback({
  wineries,
  onWineryClick,
  singleWinery,
  className,
}: {
  wineries: MapWinery[];
  onWineryClick?: (_slug: string) => void;
  singleWinery: boolean;
  className?: string;
}) {
  const points = wineries.filter(
    (w) => w.latitude != null && w.longitude != null
  );

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-stone-200 bg-cream-100',
        className
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(150,42,72,.10),transparent_42%),linear-gradient(0deg,rgba(122,27,59,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(122,27,59,.06)_1px,transparent_1px)] bg-[length:100%_100%,38px_38px,38px_38px]" />
      {points.length > 0 ? (
        points.map((winery) => {
          const position = getStaticMapPosition(winery);
          return (
            <button
              key={winery.id}
              type="button"
              onClick={() => onWineryClick?.(winery.slug)}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              aria-label={winery.name}
              disabled={!onWineryClick && !singleWinery}
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-burgundy-600 text-white shadow-audit-elevated ring-4 ring-white/85 transition-transform group-hover:scale-105">
                <MapPin className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="absolute left-1/2 top-10 hidden w-max -translate-x-1/2 rounded-md bg-white px-2 py-1 text-xs font-semibold text-ink-900 shadow-audit-card group-hover:block">
                {winery.name}
              </span>
            </button>
          );
        })
      ) : (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div>
            <MapPin className="mx-auto h-8 w-8 text-burgundy-600" />
            <p className="mt-2 text-sm font-medium text-ink-900">
              Coordonnees indisponibles
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MapFallback({
  className,
  message,
  detail,
}: {
  className?: string;
  message: string;
  detail?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl bg-stone-100 px-6 text-center text-sm text-muted-foreground',
        className
      )}
    >
      <span className="font-medium text-foreground">{message}</span>
      {detail && <span className="mt-1 text-xs">{detail}</span>}
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

function getStaticMapPosition(winery: MapWinery) {
  const longitude = winery.longitude ?? VALAIS_CENTER[0];
  const latitude = winery.latitude ?? VALAIS_CENTER[1];
  const minLng = 6.75;
  const maxLng = 8.45;
  const minLat = 45.85;
  const maxLat = 46.55;

  const x = ((longitude - minLng) / (maxLng - minLng)) * 100;
  const y = 100 - ((latitude - minLat) / (maxLat - minLat)) * 100;

  return {
    x: Math.min(92, Math.max(8, x)),
    y: Math.min(88, Math.max(12, y)),
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
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
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
      ? `<img src="${escapeAttribute(coverPhoto)}" alt="${escapeAttribute(name)}" class="h-24 w-full rounded-t-lg object-cover" />`
      : '';

    const html = `
      <div class="w-56 overflow-hidden rounded-lg bg-white shadow-lg">
        ${imgHtml}
        <div class="p-3">
          <h3 class="font-semibold text-sm text-slate-900">${escapeHtml(name)}</h3>
          <p class="mt-0.5 text-xs text-slate-500">${escapeHtml(commune)}, Valais</p>
          ${experienceCount > 0 ? `<p class="mt-1 text-xs text-burgundy-600">${t('experienceCount', { count: experienceCount })}</p>` : ''}
          <button
            data-slug="${escapeAttribute(slug)}"
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('`', '&#96;');
}
