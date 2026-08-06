import { db } from '@/server/db';
import { sortByDistance, formatDistance } from '@/lib/geo-utils';
import { publiclyVisibleWineryWhere } from '@/lib/business-rules/winery-visibility';

export interface WineryAlternative {
  name: string;
  commune: string;
  slug: string;
  /** Language-neutral distance label, e.g. "~5 km" / "<1 km". */
  distanceLabel: string;
}

/**
 * Up to `limit` publicly-visible wineries nearest to `wineryId`, for the
 * "3 alternatives proches" block of the winery-cancellation email (#5).
 *
 * Returns [] when the origin winery has no geocoded coordinates. Reuses
 * `publiclyVisibleWineryWhere` so a suspended / incomplete / experience-less
 * winery is never surfaced. Locale-agnostic: the caller builds the URL with
 * the recipient's locale from `slug`.
 */
export async function getNearbyWineryAlternatives(
  wineryId: string,
  options: { limit?: number } = {}
): Promise<WineryAlternative[]> {
  const limit = options.limit ?? 3;

  const origin = await db.winery.findUnique({
    where: { id: wineryId },
    select: { latitude: true, longitude: true },
  });
  if (!origin || origin.latitude == null || origin.longitude == null) {
    return [];
  }

  const candidates = await db.winery.findMany({
    where: { ...publiclyVisibleWineryWhere, id: { not: wineryId } },
    select: {
      name: true,
      commune: true,
      slug: true,
      latitude: true,
      longitude: true,
    },
  });

  return sortByDistance(candidates, origin.latitude, origin.longitude)
    .slice(0, limit)
    .map((w) => ({
      name: w.name,
      commune: w.commune,
      slug: w.slug,
      distanceLabel: w.distance != null ? formatDistance(w.distance) : '',
    }));
}
