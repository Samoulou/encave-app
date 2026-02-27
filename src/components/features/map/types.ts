/**
 * Winery data shape needed by map components.
 * Kept minimal to avoid leaking full Prisma types to the client.
 */
export interface MapWinery {
  id: string;
  name: string;
  slug: string;
  commune: string;
  coverPhoto: string | null;
  latitude: number | null;
  longitude: number | null;
  _count: { experiences: number };
}
