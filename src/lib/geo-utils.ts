/**
 * Geographic utility functions for distance calculations
 * Used for proximity-based search and sorting
 */

/**
 * Calculate the distance between two points using the Haversine formula
 * @param lat1 Latitude of point 1 in degrees
 * @param lng1 Longitude of point 1 in degrees
 * @param lat2 Latitude of point 2 in degrees
 * @param lng2 Longitude of point 2 in degrees
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance for display
 * @param distanceKm Distance in kilometers
 * @returns Formatted string (e.g., "~5 km" or "<1 km")
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return '<1 km';
  }
  return `~${Math.round(distanceKm)} km`;
}

/**
 * Distance tier classification
 * Used for grouping search results by proximity
 */
export type DistanceTier = 'exact' | 'nearby' | 'region' | 'far';

/**
 * Get the distance tier for a given distance
 * @param distanceKm Distance in kilometers
 * @returns Distance tier classification
 */
export function getDistanceTier(distanceKm: number): DistanceTier {
  if (distanceKm === 0) return 'exact';
  if (distanceKm <= 10) return 'nearby';
  if (distanceKm <= 25) return 'region';
  return 'far';
}

/**
 * Distance tier thresholds in km
 */
export const DISTANCE_THRESHOLDS = {
  NEARBY: 10, // km - experiences within 10km
  REGION: 25, // km - experiences within 25km
} as const;

/**
 * Sort items by distance from a reference point
 * @param items Array of items with latitude and longitude
 * @param refLat Reference latitude
 * @param refLng Reference longitude
 * @returns Items sorted by distance with distance added
 */
export function sortByDistance<
  T extends { latitude?: number | null; longitude?: number | null },
>(
  items: T[],
  refLat: number,
  refLng: number
): (T & { distance: number | null })[] {
  return items
    .map((item) => {
      const distance =
        item.latitude != null && item.longitude != null
          ? calculateDistance(refLat, refLng, item.latitude, item.longitude)
          : null;
      return { ...item, distance };
    })
    .sort((a, b) => {
      // Items without coordinates go to the end
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
}

/**
 * Group items by distance tier
 * @param items Array of items with distance
 * @returns Object with items grouped by tier
 */
export function groupByDistanceTier<T extends { distance: number | null }>(
  items: T[]
): Record<DistanceTier, T[]> {
  const groups: Record<DistanceTier, T[]> = {
    exact: [],
    nearby: [],
    region: [],
    far: [],
  };

  for (const item of items) {
    if (item.distance === null) {
      groups.far.push(item);
    } else {
      const tier = getDistanceTier(item.distance);
      groups[tier].push(item);
    }
  }

  return groups;
}

/**
 * Check if coordinates are valid
 * @param lat Latitude
 * @param lng Longitude
 * @returns True if coordinates are valid
 */
export function isValidCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined
): lat is number {
  if (lat == null || lng == null) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
