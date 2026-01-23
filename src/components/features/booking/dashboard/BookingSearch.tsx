'use client';

import { useQueryState } from 'nuqs';
import { Search, X, Loader2 } from 'lucide-react';
import { useRef, useEffect, useCallback, useState, useTransition } from 'react';

/**
 * Search input for filtering bookings by client name or email.
 * Matches the mockup design from US-UI-09.
 */
export function BookingSearch() {
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
    <div className="relative flex-1 max-w-md group">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#915564]">
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Search className="h-5 w-5" />
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search by client name, email..."
        value={localValue}
        onChange={handleChange}
        className="block w-full pl-10 pr-8 py-2.5 rounded-lg bg-[#f8f6f6] border-transparent focus:border-primary focus:bg-white focus:ring-0 text-sm text-[#1a0f12] placeholder-[#915564] transition-all"
      />
      {localValue && !isPending && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#915564] hover:text-[#1a0f12] hover:bg-[#f2e9eb] transition-colors"
          onClick={clearSearch}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Clear search</span>
        </button>
      )}
    </div>
  );
}
