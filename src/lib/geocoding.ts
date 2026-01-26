/**
 * Geocoding utility using OpenStreetMap Nominatim API
 * Free service with rate limiting (1 request/second recommended)
 * https://nominatim.org/release-docs/develop/api/Search/
 */

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
      console.error(
        `Geocoding API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = (await response.json()) as NominatimResponse[];

    if (data.length === 0) {
      console.warn(`No geocoding results for address: ${address}`);
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
    console.error('Geocoding error:', error);
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
    console.warn(
      `Full address geocoding failed, using commune center for: ${address}, ${commune}`
    );
    return {
      latitude: fallbackResult.latitude,
      longitude: fallbackResult.longitude,
    };
  }

  return null;
}

/**
 * Generate Google Maps embed URL
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
  return `https://maps.google.com/maps?q=${latitude},${longitude}&z=${zoom}&output=embed`;
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
  'https://maps.google.com/maps?q=Valais,Switzerland&z=10&output=embed';
