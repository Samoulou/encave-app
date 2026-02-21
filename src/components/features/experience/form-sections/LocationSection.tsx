import { MapPin } from 'lucide-react';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { SectionHeader } from './SectionHeader';
import type { AddressData } from './types';

interface LocationSectionProps {
  location: AddressData;
  onLocationChange: (location: AddressData) => void;
  sectionRef: (el: HTMLElement | null) => void;
}

export function LocationSection({ location, onLocationChange, sectionRef }: LocationSectionProps) {
  return (
    <section
      ref={sectionRef}
      id="location"
      className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 scroll-mt-24 shadow-sm"
    >
      <SectionHeader icon={MapPin} title="Location" />
      <div className="space-y-4">
        {/* Address Autocomplete */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Address
          </label>
          <AddressAutocomplete
            value={location}
            onChange={onLocationChange}
            placeholder="Search for an address..."
          />
          <p className="text-xs text-slate-400 mt-1">
            Start typing to search for an address
          </p>
        </div>

        {/* Display selected address details */}
        {location.street && (
          <div className="bg-slate-50 rounded-lg p-4 border border-stone-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Selected Address
            </h4>
            <div className="space-y-1 text-sm text-slate-700">
              {location.street && <p>{location.street}</p>}
              <p>
                {[location.zipCode, location.city].filter(Boolean).join(' ')}
              </p>
              {location.latitude && location.longitude && (
                <p className="text-xs text-slate-400">
                  Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
