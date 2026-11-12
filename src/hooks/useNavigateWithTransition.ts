'use client';

import { useTransition, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';

interface NavigateOptions {
  scroll?: boolean;
}

/**
 * Split an app href into its locale-less path and, when the caller already
 * prefixed it (`/fr/wineries/x`), that locale. The locale-aware router adds
 * the prefix itself — passing a prefixed path through would double it.
 */
export function splitLocalePrefix(href: string): {
  href: string;
  locale?: Locale;
} {
  for (const locale of routing.locales) {
    if (href === `/${locale}`) return { href: '/', locale };
    if (
      href.startsWith(`/${locale}/`) ||
      href.startsWith(`/${locale}?`) ||
      href.startsWith(`/${locale}#`)
    ) {
      const rest = href.slice(locale.length + 1);
      return { href: rest.startsWith('/') ? rest : `/${rest}`, locale };
    }
  }
  return { href };
}

/**
 * Hook for non-blocking navigation with visual pending state.
 * Wraps router.push in startTransition for instant UI feedback.
 *
 * Locale-aware (`@/i18n/navigation`): `navigate('/login')` lands on
 * `/{current locale}/login` directly. The plain Next router sent it to
 * `/login`, which the middleware then 307-redirected (one extra round trip,
 * and the locale came from the cookie instead of the page). Hrefs that are
 * already prefixed keep working.
 *
 * @example
 * const { navigate, prefetch, isPending } = useNavigateWithTransition();
 *
 * <button
 *   onClick={() => navigate('/booking/abc123')}
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
      const target = splitLocalePrefix(href);
      startTransition(() => {
        router.push(target.href, { ...options, locale: target.locale });
      });
    },
    [router]
  );

  const replace = useCallback(
    (href: string, options?: NavigateOptions) => {
      const target = splitLocalePrefix(href);
      startTransition(() => {
        router.replace(target.href, { ...options, locale: target.locale });
      });
    },
    [router]
  );

  const prefetch = useCallback(
    (href: string) => {
      const target = splitLocalePrefix(href);
      router.prefetch(target.href, { locale: target.locale });
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
