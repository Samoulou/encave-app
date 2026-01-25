'use client';

import { useState, FormEvent } from 'react';
import { Calendar, Search } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { LocationAutocomplete } from '@/components/features/search/LocationAutocomplete';
import { type ValaisLocation } from '@/lib/constants/locations';

export function HeroSearchBar() {
  const router = useRouter();
  const t = useTranslations('home');

  const [selectedLocation, setSelectedLocation] = useState<ValaisLocation | null>(null);
  const [dateValue, setDateValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();

    if (selectedLocation) {
      params.set('location', selectedLocation.id);
      params.set('lat', selectedLocation.latitude.toString());
      params.set('lng', selectedLocation.longitude.toString());
    }

    if (dateValue) {
      params.set('date', dateValue);
    }

    const queryString = params.toString();
    router.push(queryString ? `/experiences?${queryString}` : '/experiences');
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="bg-white dark:bg-[#2a1a1f] p-2 rounded-xl shadow-2xl flex flex-col md:flex-row items-center gap-2">
        {/* Location Input */}
        <div className="flex-1 w-full md:w-auto relative group">
          <LocationAutocomplete
            value={selectedLocation}
            onChange={setSelectedLocation}
            placeholder={t('searchLocationPlaceholder')}
            className="[&_input]:h-14 [&_input]:border-0 [&_input]:bg-transparent [&_input]:focus-visible:ring-0 [&_input]:font-medium [&_input]:rounded-lg [&_input]:hover:bg-gray-50 dark:[&_input]:hover:bg-white/5 [&_input]:transition-colors"
          />
        </div>

        {/* Divider (desktop only) */}
        <div className="hidden md:block w-px h-8 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

        {/* Date Input */}
        <div className="flex-1 w-full md:w-auto relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary z-10 pointer-events-none">
            <Calendar className="h-5 w-5" />
          </div>
          <input
            type="text"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            placeholder={t('searchDatePlaceholder')}
            className="w-full h-14 pl-12 pr-4 bg-transparent border-none outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            onFocus={(e) => {
              e.target.type = 'date';
            }}
            onBlur={(e) => {
              if (!e.target.value) {
                e.target.type = 'text';
              }
            }}
          />
        </div>

        {/* Search Button */}
        <Button
          type="submit"
          size="lg"
          className="w-full md:w-auto h-12 px-8 bg-primary hover:bg-[#a62444] text-white font-bold rounded-lg shadow-md flex items-center justify-center gap-2"
        >
          <Search className="h-5 w-5" />
          <span>{t('searchButton')}</span>
        </Button>
      </div>
    </form>
  );
}
