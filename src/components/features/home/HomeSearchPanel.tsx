'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Minus, Plus, Search, Users } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { LocationAutocomplete } from '@/components/features/search/LocationAutocomplete';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ValaisLocation } from '@/lib/constants/locations';

interface HomeSearchPanelProps {
  variant?: 'desktop' | 'mobile';
}

export function HomeSearchPanel({ variant = 'desktop' }: HomeSearchPanelProps) {
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] =
    useState<ValaisLocation | null>(null);
  const [capacity, setCapacity] = useState(2);

  const capacityLabel = useMemo(
    () => `${capacity} ${capacity > 1 ? 'personnes' : 'personne'}`,
    [capacity]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const params = new URLSearchParams();
    params.set('capacity', String(capacity));

    if (selectedLocation) {
      params.set('location', selectedLocation.id);
      params.set('lat', selectedLocation.latitude.toString());
      params.set('lng', selectedLocation.longitude.toString());
      params.set('sort', 'distance');
    }

    router.push(`/experiences?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'bg-white shadow-[0_18px_50px_-12px_rgba(58,14,31,.25),0_0_0_1px_rgba(154,42,72,.08)]',
        variant === 'desktop'
          ? 'flex max-w-[720px] items-center rounded-[18px] p-1.5'
          : 'grid grid-cols-2 overflow-visible rounded-[18px]'
      )}
    >
      <div
        className={cn(
          variant === 'desktop'
            ? 'min-w-0 flex-[1.25] border-r border-stone-200 px-[18px] py-2'
            : 'col-span-2 border-b border-[#efe4e6] px-3.5 py-3'
        )}
      >
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-burgundy-700">
          Ou
        </div>
        <LocationAutocomplete
          value={selectedLocation}
          onChange={setSelectedLocation}
          placeholder="Tout le Valais"
          className="mt-1 [&_input]:h-9 [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-8 [&_input]:text-sm [&_input]:font-semibold [&_input]:text-ink-900 [&_input]:shadow-none [&_input]:placeholder:text-ink-900 [&_input]:focus-visible:ring-0"
        />
      </div>

      <div
        className={cn(
          variant === 'desktop'
            ? 'min-w-[178px] px-[18px] py-2'
            : 'col-span-2 border-b border-[#efe4e6] px-3.5 py-3'
        )}
      >
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-burgundy-700">
          Pour
        </div>
        <div className="mt-1 flex h-9 items-center gap-2">
          <Users className="h-4 w-4 text-ink-500" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">
            {capacityLabel}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setCapacity((value) => Math.max(1, value - 1))}
              className="grid h-7 w-7 place-items-center rounded-full border border-stone-200 text-ink-700 transition-colors hover:border-burgundy-200 hover:bg-cream-100"
              aria-label="Retirer une personne"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setCapacity((value) => Math.min(20, value + 1))}
              className="grid h-7 w-7 place-items-center rounded-full border border-stone-200 text-ink-700 transition-colors hover:border-burgundy-200 hover:bg-cream-100"
              aria-label="Ajouter une personne"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        className={cn(
          'gap-2 bg-burgundy-600 text-sm font-semibold text-white transition-colors hover:bg-burgundy-700',
          variant === 'desktop'
            ? 'ml-1.5 h-[62px] rounded-[14px] px-7'
            : 'col-span-2 h-12 rounded-none rounded-b-[18px]'
        )}
      >
        <Search className="h-[15px] w-[15px]" aria-hidden="true" />
        Explorer
      </Button>
    </form>
  );
}
