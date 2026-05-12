import { MapPin } from 'lucide-react';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { SectionHeader } from './SectionHeader';
import type { AddressData } from './types';

interface LocationSectionProps {
  location: AddressData;
  onLocationChange: (_location: AddressData) => void;
  sectionRef: (_el: HTMLElement | null) => void;
}

export function LocationSection({
  location,
  onLocationChange,
  sectionRef,
}: LocationSectionProps) {
  return (
    <section
      ref={sectionRef}
      id="location"
      className="scroll-mt-24 rounded-xl border border-stone-200 bg-white p-6 shadow-sm md:p-8"
    >
      <SectionHeader icon={MapPin} title="Location" />
      <div className="space-y-4">
        {/* Address Autocomplete */}
        <div>
          <label
            htmlFor="location-address"
            className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Address
          </label>
          <AddressAutocomplete
            id="location-address"
            value={location}
            onChange={onLocationChange}
            placeholder="Search for an address..."
          />
          <p className="mt-1 text-xs text-slate-400">
            Start typing to search for an address
          </p>
        </div>

        {/* Display selected address details */}
        {location.street && (
          <div className="rounded-lg border border-stone-200 bg-slate-50 p-4">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Selected Address
            </h4>
            <div className="space-y-1 text-sm text-slate-700">
              {location.street && <p>{location.street}</p>}
              <p>
                {[location.zipCode, location.city].filter(Boolean).join(' ')}
              </p>
              {location.latitude && location.longitude && (
                <p className="text-xs text-slate-400">
                  Coordinates: {location.latitude.toFixed(6)},{' '}
                  {location.longitude.toFixed(6)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
