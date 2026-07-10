import {
  getPubliclyVisibleWineries,
  getDistinctCommunes,
} from '@/server/queries/winery.queries';
import {
  WineriesExplorer,
  type WineryCardDTO,
} from '@/components/features/winery/WineriesExplorer';
import type { MapWinery } from '@/components/features/map/types';

/**
 * Async server component that fetches winery data (P-06: always the
 * FULL visible list — the commune filter is client-side in
 * WineriesExplorer, which keeps this subtree ISR-compatible).
 */
export async function WineriesContent() {
  const [wineries, communes] = await Promise.all([
    getPubliclyVisibleWineries(),
    getDistinctCommunes(),
  ]);

  // Minimal DTOs across the RSC boundary — never full Prisma objects.
  const cardWineries: WineryCardDTO[] = wineries.map((w) => ({
    id: w.id,
    slug: w.slug,
    name: w.name,
    commune: w.commune,
    description: w.description,
    coverPhoto: w.coverPhoto,
    status: w.status,
  }));

  const mapWineries: MapWinery[] = wineries.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    commune: w.commune,
    coverPhoto: w.coverPhoto,
    latitude: w.latitude,
    longitude: w.longitude,
    _count: w._count,
  }));

  return (
    <WineriesExplorer
      wineries={cardWineries}
      mapWineries={mapWineries}
      communes={communes}
    />
  );
}
