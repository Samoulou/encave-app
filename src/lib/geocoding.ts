/**
 * Geocoding utility using OpenStreetMap Nominatim API
 * Free service with rate limiting (1 request/second recommended)
 * https://nominatim.org/release-docs/develop/api/Search/
 */

import { logError, logWarn } from '@/lib/logger';

interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Geocode an address to coordinates using Nominatim
 * @param address Full address string (e.g., "Route de Sion 1, Sierre, Valais, Switzerland")
 * @returns Coordinates or null if geocoding fails
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodingResult | null> {
  try {
    // Add Switzerland and Valais context for better results
    const searchQuery = address.includes('Switzerland')
      ? address
      : `${address}, Switzerland`;

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: searchQuery,
          format: 'json',
          limit: '1',
          addressdetails: '1',
        }),
      {
        headers: {
          // Nominatim requires a valid User-Agent
          'User-Agent': 'EnCave/1.0 (https://encave.ch)',
        },
      }
    );

    if (!response.ok) {
      logError(`Geocoding API error: ${response.status} ${response.statusText}`, undefined, { action: 'geocodeAddress' });
      return null;
    }

    const data = (await response.json()) as NominatimResponse[];

    if (data.length === 0) {
      logWarn(`No geocoding results for address: ${address}`, { action: 'geocodeAddress' });
      return null;
    }

    const result = data[0];
    if (!result) {
      return null;
    }

    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      displayName: result.display_name,
    };
  } catch (error) {
    logError('Geocoding error', error, { action: 'geocodeAddress' });
    return null;
  }
}

/**
 * Geocode a winery address with commune context
 * @param address Street address
 * @param commune Town/commune name
 * @returns Coordinates or null if geocoding fails
 */
export async function geocodeWineryAddress(
  address: string,
  commune: string
): Promise<{ latitude: number; longitude: number } | null> {
  const fullAddress = `${address}, ${commune}, Valais, Switzerland`;
  const result = await geocodeAddress(fullAddress);

  if (result) {
    return {
      latitude: result.latitude,
      longitude: result.longitude,
    };
  }

  // Fallback: try with just commune if full address fails
  const fallbackResult = await geocodeAddress(`${commune}, Valais, Switzerland`);

  if (fallbackResult) {
    logWarn(`Full address geocoding failed, using commune center for: ${address}, ${commune}`, { action: 'geocodeWineryAddress' });
    return {
      latitude: fallbackResult.latitude,
      longitude: fallbackResult.longitude,
    };
  }

  return null;
}

/**
 * Generate OpenStreetMap embed URL
 * @param latitude Latitude coordinate
 * @param longitude Longitude coordinate
 * @param zoom Zoom level (default 15 for street-level view)
 * @returns Embed URL string
 */
export function getMapEmbedUrl(
  latitude: number,
  longitude: number,
  zoom: number = 15
): string {
  // Calculate bounding box for the embed (roughly 0.01 degrees around the point)
  const delta = 0.005 * (18 - zoom); // Adjust delta based on zoom
  const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
}

/**
 * Get Google Maps directions URL
 * @param latitude Latitude coordinate
 * @param longitude Longitude coordinate
 * @param placeName Optional place name for the destination
 * @returns Google Maps URL
 */
export function getGoogleMapsUrl(
  latitude: number,
  longitude: number,
  placeName?: string
): string {
  const destination = placeName
    ? encodeURIComponent(placeName)
    : `${latitude},${longitude}`;

  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&destination_place_id=`;
}

/**
 * Fallback map URL showing Valais region
 * Used when coordinates are unavailable
 */
export const VALAIS_FALLBACK_MAP_URL =
  'https://www.openstreetmap.org/export/embed.html?bbox=6.8,45.9,8.0,46.5&layer=mapnik';
