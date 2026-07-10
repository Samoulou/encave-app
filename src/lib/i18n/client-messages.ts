import { getMessages } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';

/**
 * Client-message subsets (P-06 / L-203). The full locale file (~116 kB)
 * used to be serialized into EVERY page's HTML via the root
 * NextIntlClientProvider. Only CLIENT components read the provider —
 * server components go through getTranslations/useTranslations on the
 * request config, which always sees the full file. So we ship each
 * route group only the namespaces its client islands actually use.
 *
 * Nested providers REPLACE the parent context: a segment layout must
 * always provide BASE + its extras, never the extras alone.
 *
 * Guards against a missed namespace:
 *  - tests/unit/i18n/client-namespaces.test.ts (static mapping check)
 *  - onError throws on MISSING_MESSAGE outside production (i18n/request.ts)
 *  - the Playwright console listener fails E2E on IntlError
 */

/**
 * Namespaces needed by client components present on EVERY route
 * (header islands, consent banner, error boundaries, home panels,
 * auth forms, the public reservation error page).
 * Dotted entries pick a nested subtree (e.g. legal.cookies only).
 */
export const PUBLIC_BASE_NAMESPACES: readonly string[] = [
  'nav',
  'common',
  'errors',
  'locale',
  'search',
  'wineries', // InteractiveMap — mounted on the home desktop editorial
  'auth',
  'bookingError',
  'legal.cookies',
];

/** Extra client namespaces per public route segment. */
export const SEGMENT_EXTRA_NAMESPACES = {
  experiences: [
    'experience',
    'gallery',
    'booking',
    'cancellation',
    'checkout',
    'winery',
  ],
  wineries: ['winery', 'experience', 'gallery'],
  booking: [
    'booking',
    'confirmation',
    'cancellation',
    'wineOrder',
    'experience',
  ],
} as const;

function pickPath(
  source: AbstractIntlMessages,
  target: Record<string, unknown>,
  path: string
): void {
  const [head, ...rest] = path.split('.');
  if (!head) return;
  const value = source[head];
  if (value === undefined) return;
  if (rest.length === 0) {
    target[head] = value;
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  const nested = (target[head] ?? {}) as Record<string, unknown>;
  target[head] = nested;
  pickPath(value as AbstractIntlMessages, nested, rest.join('.'));
}

/**
 * Build the client-message subset for a route group. `locale` comes from
 * the layout's params so the call stays static-rendering compatible.
 */
export async function getClientMessages(
  locale: string,
  extra: readonly string[] = []
): Promise<AbstractIntlMessages> {
  const all = await getMessages({ locale });
  const subset: Record<string, unknown> = {};
  for (const path of [...PUBLIC_BASE_NAMESPACES, ...extra]) {
    pickPath(all, subset, path);
  }
  return subset as AbstractIntlMessages;
}
