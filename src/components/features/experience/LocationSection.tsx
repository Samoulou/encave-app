'use client';

import { MapPin, Car, Train } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('experience');

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
    <section data-testid="location-section">
      <h3 className="text-2xl font-bold mb-4 text-[#1a0f12]">
        {t('whereYoullBe')}
      </h3>
      <p className="text-gray-600 mb-4" data-testid="winery-address">
        {fullAddress}
      </p>

      {/* Map Embed */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full h-80 rounded-xl overflow-hidden shadow-sm relative group"
      >
        <iframe
          title={`Map showing location of ${wineryName}`}
          src={mapEmbedUrl}
          className="w-full h-full border-0 pointer-events-none"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        {/* Map Marker Overlay */}
        {hasCoordinates && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="bg-white p-2 rounded-full shadow-xl">
              <MapPin className="h-7 w-7 text-primary" />
            </div>
          </div>
        )}
      </a>

      {/* Additional Info */}
      <div className="mt-4 flex gap-6 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Car className="h-5 w-5" />
          <span>{t('freeParking')}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Train className="h-5 w-5" />
          <span>{t('nearStation', { commune })}</span>
        </div>
      </div>
    </section>
  );
}
