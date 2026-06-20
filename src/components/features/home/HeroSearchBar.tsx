'use client';

import { useState, FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { LocationAutocomplete } from '@/components/features/search/LocationAutocomplete';
import { type ValaisLocation } from '@/lib/constants/locations';

export function HeroSearchBar() {
  const router = useRouter();
  const t = useTranslations('home');

  const [selectedLocation, setSelectedLocation] =
    useState<ValaisLocation | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();

    if (selectedLocation) {
      params.set('location', selectedLocation.id);
      params.set('lat', selectedLocation.latitude.toString());
      params.set('lng', selectedLocation.longitude.toString());
    }

    const queryString = params.toString();
    router.push(queryString ? `/experiences?${queryString}` : '/experiences');
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl">
      <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-2 shadow-2xl dark:bg-[#2a1a1f] md:flex-row">
        {/* Location Input */}
        <div className="group relative w-full flex-1 md:w-auto">
          <LocationAutocomplete
            value={selectedLocation}
            onChange={setSelectedLocation}
            placeholder={t('searchLocationPlaceholder')}
            className="[&_input]:h-14 [&_input]:rounded-lg [&_input]:border-0 [&_input]:bg-transparent [&_input]:font-medium [&_input]:transition-colors [&_input]:hover:bg-muted [&_input]:focus-visible:ring-0 dark:[&_input]:hover:bg-white/5"
          />
        </div>

        {/* Search Button */}
        <Button
          type="submit"
          size="lg"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-8 font-bold text-white shadow-md hover:bg-[hsl(var(--primary-hover))] md:w-auto"
        >
          <Search className="h-5 w-5" />
          <span>{t('searchButton')}</span>
        </Button>
      </div>
    </form>
  );
}
