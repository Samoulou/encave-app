import { MapPin, ExternalLink } from 'lucide-react';

interface LocationSectionProps {
  address: string;
  commune: string;
  wineryName: string;
}

export function LocationSection({
  address,
  commune,
  wineryName,
}: LocationSectionProps) {
  const fullAddress = `${address}, ${commune}, Valais, Switzerland`;
  const encodedAddress = encodeURIComponent(fullAddress);

  // Google Maps link for external navigation
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

  return (
    <section className="rounded-xl bg-white p-6 shadow-warm lg:p-8">
      <h2 className="font-display text-xl font-semibold text-slate-900">
        Location
      </h2>

      {/* Address */}
      <div className="mt-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-burgundy-50">
          <MapPin className="h-5 w-5 text-burgundy-600" />
        </div>
        <div>
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
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent('7.0,46.0,8.0,46.5')}&layer=mapnik`}
          className="h-64 w-full"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="bg-stone-50 px-3 py-2 text-center">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-600 hover:text-burgundy-600"
          >
            View larger map
          </a>
        </div>
      </div>
    </section>
  );
}
