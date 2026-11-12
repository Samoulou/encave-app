import { MetadataRoute } from 'next';
import { locales } from '@/i18n/routing';

/**
 * Private areas, WITHOUT the locale prefix. Every page lives under
 * `/{locale}/…` (localePrefix: always), and robots.txt rules are plain
 * path prefixes matched from the root: the former `/dashboard/` and
 * `/admin/` rules never matched `/fr/dashboard/…` — they protected nothing.
 * Each entry below is therefore emitted once per locale.
 *
 * Only auth-gated or token-addressed areas belong here. Public pages that
 * must stay out of the index (checkout, ticket, confirmation…) carry a
 * `noindex` meta instead: a crawler has to FETCH a page to see its noindex,
 * so disallowing them here would be counter-productive.
 */
const PRIVATE_PATHS = [
  '/dashboard',
  '/admin', // also covers /admin-setup
  '/onboarding',
  '/invitation/',
] as const;

export default function robots(): MetadataRoute.Robots {
  // Same source as sitemap.ts and the canonical URLs (src/lib/seo/metadata.ts)
  // — the legacy NEXT_PUBLIC_SITE_URL stays as a fallback.
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://encave.ch';

  const localizedPrivatePaths = locales.flatMap((locale) =>
    PRIVATE_PATHS.map((path) => `/${locale}${path}`)
  );

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/_next/',
          // /coming-soon: pre-launch gate page — never index (P-16 / WS-H)
          '/coming-soon',
          ...localizedPrivatePaths,
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
