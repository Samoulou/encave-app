'use client';

import { useState, useEffect, useTransition, useOptimistic } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface UseDebouncedSearchOptions {
  /** Debounce delay in milliseconds (default: 300) */
  delay?: number;
  /** URL parameter name for the search query (default: 'q') */
  paramName?: string;
}

interface UseDebouncedSearchReturn {
  /** Current value of the input field */
  inputValue: string;
  /** Setter for the input value */
  setInputValue: (_value: string) => void;
  /** Optimistic query value (updates immediately for UI) */
  query: string;
  /** Whether the server is still processing the search */
  isPending: boolean;
  /** Whether the input differs from the server-confirmed value */
  isStale: boolean;
}

/**
 * Hook for debounced search with stale-while-revalidate UX.
 * Updates UI optimistically while syncing with server in background.
 *
 * @example
 * const { inputValue, setInputValue, isPending, isStale } = useDebouncedSearch();
 *
 * <input
 *   value={inputValue}
 *   onChange={(e) => setInputValue(e.target.value)}
 *   className={isStale ? 'border-amber-400' : ''}
 * />
 * {isPending && <Loader2 className="animate-spin" />}
 */
export function useDebouncedSearch({
  delay = 300,
  paramName = 'q',
}: UseDebouncedSearchOptions = {}): UseDebouncedSearchReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const serverQuery = searchParams.get(paramName) || '';
  const [inputValue, setInputValue] = useState(serverQuery);
  const [optimisticQuery, setOptimisticQuery] = useOptimistic(serverQuery);

  // Sync input when URL changes externally (e.g., back/forward navigation)
  useEffect(() => {
    setInputValue(serverQuery);
  }, [serverQuery]);

  // Debounce and update URL
  useEffect(() => {
    if (inputValue === serverQuery) return;

    const timer = setTimeout(() => {
      setOptimisticQuery(inputValue);
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (inputValue) {
          params.set(paramName, inputValue);
        } else {
          params.delete(paramName);
        }
        router.push(`?${params.toString()}`, { scroll: false });
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [inputValue, delay, paramName, router, searchParams, serverQuery, setOptimisticQuery]);

  return {
    inputValue,
    setInputValue,
    query: optimisticQuery,
    isPending,
    isStale: inputValue !== serverQuery,
  };
}
