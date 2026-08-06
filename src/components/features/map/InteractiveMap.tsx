'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTranslations } from 'next-intl';
import { Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapWinery } from './types';

const VALAIS_CENTER: [number, number] = [7.6, 46.3];
const DEFAULT_ZOOM = 9.5;

const CARTO_VOYAGER_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'carto',
      type: 'raster',
      source: 'carto',
    },
  ],
};

const CLUSTER_COLORS = {
  small: '#962a48',
  medium: '#732040',
  large: '#450a1c',
};

interface InteractiveMapProps {
  wineries: MapWinery[];
  onWineryClick?: (_slug: string) => void;
  className?: string;
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
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapError, setMapError] = useState(false);
  const geojson = useMemo(() => buildGeoJSON(wineries), [wineries]);

  const cleanupMap = useCallback(() => {
    popup.current?.remove();
    map.current?.remove();
    map.current = null;
  }, []);

  const initMap = useCallback(() => {
    if (!mapContainer.current || map.current) return false;

    const rect = mapContainer.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    try {
      const firstWinery =
        singleWinery && wineries.length === 1 ? wineries[0] : undefined;
      const center: [number, number] =
        firstWinery?.longitude != null && firstWinery?.latitude != null
          ? [firstWinery.longitude, firstWinery.latitude]
          : VALAIS_CENTER;

      const m = new maplibregl.Map({
        container: mapContainer.current,
        style: CARTO_VOYAGER_STYLE,
        center,
        zoom: singleWinery ? 13 : DEFAULT_ZOOM,
        minZoom: 7,
        maxZoom: 17,
        attributionControl: false,
      });

      m.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        'bottom-left'
      );
      m.addControl(new maplibregl.NavigationControl(), 'top-right');

      m.on('load', () => {
        addSources(m, geojson, singleWinery);
        addLayers(m, singleWinery);
        addInteractions(m, onWineryClick, t, popup);
        m.resize();
      });

      m.on('error', (event) => {
        if (!String(event.error?.message ?? '').includes('Failed to fetch')) {
          setMapError(true);
        }
      });

      map.current = m;
      return true;
    } catch {
      setMapError(true);
      return false;
    }
  }, [geojson, onWineryClick, singleWinery, t, wineries]);

  useEffect(() => {
    const container = mapContainer.current;
    const tryInit = () => {
      if (map.current) {
        map.current.resize();
        return;
      }

      initMap();
    };

    tryInit();

    const resizeObserver =
      container && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(tryInit)
        : null;

    if (container && resizeObserver) {
      resizeObserver.observe(container);
    }

    window.addEventListener('resize', tryInit);

    return () => {
      window.removeEventListener('resize', tryInit);
      resizeObserver?.disconnect();
      cleanupMap();
    };
  }, [cleanupMap, initMap]);

  useEffect(() => {
    const m = map.current;
    if (!m || !m.isStyleLoaded()) return;

    const source = m.getSource('wineries') as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData(geojson);
  }, [geojson]);

  const handleLocate = useCallback(() => {
    if (!map.current || isLocating) return;
    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        map.current?.flyTo({ center: [longitude, latitude], zoom: 12 });

        new maplibregl.Marker({ color: '#4f46e5' })
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

      {!singleWinery && (
        <button
          type="button"
          onClick={handleLocate}
          disabled={isLocating}
          className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-foreground shadow-warm transition-colors hover:bg-stone-50 disabled:opacity-60"
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

function buildGeoJSON(wineries: MapWinery[]): GeoJSON.FeatureCollection {
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
  m: maplibregl.Map,
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

function addLayers(m: maplibregl.Map, singleWinery: boolean) {
  if (!singleWinery) {
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
  m: maplibregl.Map,
  onWineryClick: ((_slug: string) => void) | undefined,
  t: ReturnType<typeof useTranslations<'wineries'>>,
  popupRef: React.MutableRefObject<maplibregl.Popup | null>
) {
  m.on('click', 'clusters', (e) => {
    const features = m.queryRenderedFeatures(e.point, {
      layers: ['clusters'],
    });
    const feature = features[0];
    if (!feature || feature.geometry.type !== 'Point') return;

    const clusterId = feature.properties?.cluster_id as number | undefined;
    const source = m.getSource('wineries') as maplibregl.GeoJSONSource;
    if (clusterId == null) return;

    source.getClusterExpansionZoom(clusterId).then((zoom) => {
      m.easeTo({
        center: (feature.geometry as GeoJSON.Point).coordinates as [
          number,
          number,
        ],
        zoom,
      });
    });
  });

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
    const p = new maplibregl.Popup({
      closeButton: true,
      maxWidth: '240px',
      className: 'encave-popup',
    })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(m);

    popupRef.current = p;

    const el = p.getElement();
    const btn = el?.querySelector('button[data-slug]');
    if (btn && onWineryClick) {
      btn.addEventListener('click', () => {
        onWineryClick(slug);
      });
    }
  });

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
