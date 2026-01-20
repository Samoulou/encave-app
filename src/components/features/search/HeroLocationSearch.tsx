'use client';

import { useState, FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LocationAutocomplete } from './LocationAutocomplete';
import { type ValaisLocation, getLocationDisplayName } from '@/lib/constants/locations';

interface HeroLocationSearchProps {
  searchPlaceholder?: string;
  locationPlaceholder?: string;
  buttonText?: string;
}

export function HeroLocationSearch({
  searchPlaceholder,
  locationPlaceholder,
  buttonText,
}: HeroLocationSearchProps) {
  const router = useRouter();
  const t = useTranslations('home');
  const tSearch = useTranslations('search');

  const [selectedLocation, setSelectedLocation] = useState<ValaisLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();

    if (selectedLocation) {
      params.set('location', selectedLocation.id);
      params.set('lat', selectedLocation.latitude.toString());
      params.set('lng', selectedLocation.longitude.toString());
    }

    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    }

    const queryString = params.toString();
    router.push(queryString ? `/experiences?${queryString}` : '/experiences');
  };

  const handleClearLocation = () => {
    setSelectedLocation(null);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-2">
        {/* Location and search inputs */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Location Input */}
          <div className="relative flex-1">
            {selectedLocation ? (
              <div className="flex items-center h-12 px-3 bg-burgundy-50 rounded-lg border border-burgundy-200">
                <span className="flex-1 text-sm font-medium text-burgundy-800 truncate">
                  {getLocationDisplayName(selectedLocation)}
                </span>
                <button
                  type="button"
                  onClick={handleClearLocation}
                  className="ml-2 text-burgundy-500 hover:text-burgundy-700 transition-colors"
                  aria-label={tSearch('clearLocation')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <LocationAutocomplete
                value={selectedLocation}
                onChange={setSelectedLocation}
                placeholder={locationPlaceholder || tSearch('locationPlaceholder')}
                className="[&_input]:h-12 [&_input]:border-0 [&_input]:bg-transparent [&_input]:focus-visible:ring-0"
              />
            )}
          </div>

          {/* Divider (desktop only) */}
          <div className="hidden sm:block w-px bg-slate-200 my-2" aria-hidden="true" />

          {/* Text Search Input */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder || t('searchPlaceholder')}
              className="h-12 pl-10 pr-4 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label={searchPlaceholder || t('searchPlaceholder')}
            />
          </div>

          {/* Search Button */}
          <Button type="submit" size="lg" className="h-12 px-6 shrink-0">
            {buttonText || t('searchButton')}
          </Button>
        </div>
      </div>
    </form>
  );
}
