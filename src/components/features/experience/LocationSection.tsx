import { MapPin, ExternalLink } from 'lucide-react';
import {
  getMapEmbedUrl,
  VALAIS_FALLBACK_MAP_URL,
} from '@/lib/geocoding';

interface LocationSectionProps {
  address: string;
  commune: string;
  wineryName: string;
  latitude?: number | null;
  longitude?: number | null;
}

export function LocationSection({
  address,
  commune,
  wineryName,
  latitude,
  longitude,
}: LocationSectionProps) {
  const fullAddress = `${address}, ${commune}, Valais, Switzerland`;
  const hasCoordinates = latitude != null && longitude != null;

  // Google Maps link - use coordinates if available, otherwise address
  const googleMapsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  // Map embed URL - use coordinates with marker if available, otherwise fallback
  const mapEmbedUrl = hasCoordinates
    ? getMapEmbedUrl(latitude, longitude, 15)
    : VALAIS_FALLBACK_MAP_URL;

  return (
    <section className="rounded-xl bg-white p-6 shadow-warm lg:p-8" data-testid="location-section">
      <h2 className="font-display text-xl font-semibold text-slate-900">
        Location
      </h2>

      {/* Address */}
      <div className="mt-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-burgundy-50">
          <MapPin className="h-5 w-5 text-burgundy-600" />
        </div>
        <div data-testid="winery-address">
          <p className="font-medium text-slate-900">{wineryName}</p>
          <p className="text-sm text-slate-600">{address}</p>
          <p className="text-sm text-slate-600">{commune}, Valais</p>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-burgundy-600 transition-colors hover:text-burgundy-800"
          >
            Get directions
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Map Embed */}
      <div className="mt-6 overflow-hidden rounded-lg border border-stone-200">
        <iframe
          title={`Map showing location of ${wineryName}`}
          src={mapEmbedUrl}
          className="h-64 w-full"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="bg-stone-50 px-3 py-2 text-center">
          {hasCoordinates ? (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-600 hover:text-burgundy-600"
            >
              View larger map
            </a>
          ) : (
            <span className="text-xs text-slate-500">
              Exact location will be provided after booking confirmation
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
