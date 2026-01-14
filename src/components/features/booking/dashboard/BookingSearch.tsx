'use client';

import { useQueryState } from 'nuqs';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRef, useEffect, useCallback, useState, useTransition } from 'react';

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
    <div className="relative">
      {isPending ? (
        <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-burgundy-600 animate-spin" />
      ) : (
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      )}
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search by client name or reference..."
        value={localValue}
        onChange={handleChange}
        className="h-9 w-full pl-9 pr-8 sm:w-[280px]"
      />
      {localValue && !isPending && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
          onClick={clearSearch}
        >
          <X className="h-3 w-3" />
          <span className="sr-only">Clear search</span>
        </Button>
      )}
    </div>
  );
}
