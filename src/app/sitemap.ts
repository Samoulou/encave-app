import type { MetadataRoute } from 'next';
import { locales, defaultLocale } from '@/i18n/routing';
import { getAllPublishedExperienceSlugs } from '@/server/queries/experience.queries';
import { getAllVerifiedWinerySlugs } from '@/server/queries/winery.queries';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://encave.ch';

type SitemapEntry = MetadataRoute.Sitemap[number];

/**
 * Generate alternates object for hreflang annotations
 */
function generateAlternates(path: string): SitemapEntry['alternates'] {
  const languages: Record<string, string> = {};

  for (const locale of locales) {
    languages[locale] = `${BASE_URL}/${locale}${path}`;
  }

  // x-default points to the default locale
  languages['x-default'] = `${BASE_URL}/${defaultLocale}${path}`;

  return { languages };
}

/**
 * Create a sitemap entry with all locale variants
 */
function createEntry(
  path: string,
  changeFrequency: SitemapEntry['changeFrequency'],
  priority: number,
  lastModified?: Date
): SitemapEntry[] {
  return locales.map((locale) => ({
    url: `${BASE_URL}/${locale}${path}`,
    lastModified: lastModified || new Date(),
    changeFrequency,
    priority,
    alternates: generateAlternates(path),
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  // Home page - highest priority
  entries.push(...createEntry('', 'daily', 1.0));

  // Listing pages - high priority
  entries.push(...createEntry('/experiences', 'daily', 0.9));
  entries.push(...createEntry('/wineries', 'daily', 0.9));

  // Auth pages (lower priority, but still indexed for discoverability)
  entries.push(...createEntry('/login', 'monthly', 0.3));
  entries.push(...createEntry('/register', 'monthly', 0.3));

  // Legal pages
  entries.push(...createEntry('/legal/privacy', 'monthly', 0.2));
  entries.push(...createEntry('/legal/terms', 'monthly', 0.2));
  entries.push(...createEntry('/legal/cancellation', 'monthly', 0.2));

  // Dynamic pages - experiences
  try {
    const experienceSlugs = await getAllPublishedExperienceSlugs();
    for (const slug of experienceSlugs) {
      entries.push(...createEntry(`/experiences/${slug}`, 'weekly', 0.8));
    }
  } catch (error) {
    console.error('Error fetching experience slugs for sitemap:', error);
  }

  // Dynamic pages - wineries
  try {
    const winerySlugs = await getAllVerifiedWinerySlugs();
    for (const slug of winerySlugs) {
      entries.push(...createEntry(`/wineries/${slug}`, 'weekly', 0.8));
    }
  } catch (error) {
    console.error('Error fetching winery slugs for sitemap:', error);
  }

  return entries;
}
