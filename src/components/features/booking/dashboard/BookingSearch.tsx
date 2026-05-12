'use client';

import { useQueryState } from 'nuqs';
import { Search, X, Loader2 } from 'lucide-react';
import { useRef, useEffect, useCallback, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Search input for filtering bookings by client name or email.
 * Matches the mockup design from US-UI-09.
 */
export function BookingSearch() {
  const t = useTranslations('bookings');
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useQueryState('search', {
    shallow: false,
    startTransition,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(search ?? '');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local value with URL state
  useEffect(() => {
    setLocalValue(search ?? '');
  }, [search]);

  const debouncedSetSearch = useCallback(
    (value: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setSearch(value || null);
      }, 300);
    },
    [setSearch]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalValue(value);
    debouncedSetSearch(value);
  };

  const clearSearch = () => {
    setLocalValue('');
    setSearch(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="group relative max-w-md flex-1">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#915564]">
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Search className="h-5 w-5" />
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        value={localValue}
        onChange={handleChange}
        className="block w-full rounded-lg border-transparent bg-[#f8f6f6] py-2.5 pl-10 pr-8 text-sm text-foreground placeholder-[#915564] transition-all focus:border-primary focus:bg-white focus:ring-0"
      />
      {localValue && !isPending && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#915564] transition-colors hover:bg-primary-light hover:text-foreground"
          onClick={clearSearch}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t('search.clear')}</span>
        </button>
      )}
    </div>
  );
}
