'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useCallback } from 'react';

interface NavigateOptions {
  scroll?: boolean;
}

/**
 * Hook for non-blocking navigation with visual pending state.
 * Wraps router.push in startTransition for instant UI feedback.
 *
 * @example
 * const { navigate, prefetch, isPending } = useNavigateWithTransition();
 *
 * <button
 *   onClick={() => navigate('/bookings/123')}
 *   disabled={isPending}
 *   className={isPending ? 'opacity-50' : ''}
 * >
 *   {isPending ? 'Loading...' : 'View Details'}
 * </button>
 */
export function useNavigateWithTransition() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string, options?: NavigateOptions) => {
      startTransition(() => {
        router.push(href, options);
      });
    },
    [router]
  );

  const replace = useCallback(
    (href: string, options?: NavigateOptions) => {
      startTransition(() => {
        router.replace(href, options);
      });
    },
    [router]
  );

  const prefetch = useCallback(
    (href: string) => {
      router.prefetch(href);
    },
    [router]
  );

  return {
    navigate,
    replace,
    prefetch,
    isPending,
  };
}
