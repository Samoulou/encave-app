import {
  getPubliclyVisibleWineries,
  getDistinctCommunes,
} from '@/server/queries/winery.queries';
import {
  WineriesExplorer,
  type WineryCardDTO,
} from '@/components/features/winery/WineriesExplorer';
import type { MapWinery } from '@/components/features/map/types';

const EXCERPT_LENGTH = 220;

function toExcerpt(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > EXCERPT_LENGTH
    ? `${text.slice(0, EXCERPT_LENGTH).trimEnd()}…`
    : text;
}

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
  // The card clamps to 2 lines: ship an excerpt, not the whole
  // @db.Text profile (same discipline as SEARCH_CARD_SELECT).
  const cardWineries: WineryCardDTO[] = wineries.map((w) => ({
    id: w.id,
    slug: w.slug,
    name: w.name,
    commune: w.commune,
    description: toExcerpt(w.description),
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
