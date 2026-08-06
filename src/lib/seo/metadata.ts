import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from '@/i18n/routing';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://encave.ch';

/**
 * Map locale codes to og:locale format
 */
const ogLocaleMap: Record<Locale, string> = {
  fr: 'fr_CH',
  de: 'de_CH',
  en: 'en_US',
};

/**
 * Generate hreflang alternate links for a given path
 */
export function generateAlternateLinks(path: string = '') {
  const alternates: Record<string, string> = {};

  for (const locale of locales) {
    const url = `${BASE_URL}/${locale}${path}`;
    alternates[locale] = url;
  }

  // x-default points to the default locale (French)
  alternates['x-default'] = `${BASE_URL}/${defaultLocale}${path}`;

  return alternates;
}

/**
 * Generate canonical URL for a given locale and path
 */
export function generateCanonicalUrl(locale: Locale, path: string = '') {
  return `${BASE_URL}/${locale}${path}`;
}

/**
 * Generate OpenGraph locale metadata
 */
export function generateOgLocale(locale: Locale) {
  const ogLocale = ogLocaleMap[locale];
  const alternateLocales = locales
    .filter((l) => l !== locale)
    .map((l) => ogLocaleMap[l]);

  return {
    locale: ogLocale,
    alternateLocales,
  };
}

interface GenerateMetadataOptions {
  locale: Locale;
  path?: string;
  titleKey?: string;
  descriptionKey?: string;
  namespace?: string;
  titleParams?: Record<string, string>;
  descriptionParams?: Record<string, string>;
  images?: string[];
  noIndex?: boolean;
}

/**
 * Generate full page metadata with SEO best practices
 */
export async function generatePageMetadata({
  locale,
  path = '',
  titleKey = 'title',
  descriptionKey = 'description',
  namespace = 'metadata',
  titleParams = {},
  descriptionParams = {},
  images = [],
  noIndex = false,
}: GenerateMetadataOptions): Promise<Metadata> {
  const [t, tMeta] = await Promise.all([
    getTranslations({ locale, namespace }),
    getTranslations({ locale, namespace: 'metadata' }),
  ]);

  const title = t(titleKey, titleParams);
  const description = t(descriptionKey, descriptionParams);
  const siteName = tMeta('siteName');
  const canonicalUrl = generateCanonicalUrl(locale, path);
  const alternates = generateAlternateLinks(path);
  const ogLocale = generateOgLocale(locale);

  const metadata: Metadata = {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: alternates,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName,
      locale: ogLocale.locale,
      alternateLocale: ogLocale.alternateLocales,
      type: 'website',
      images: images.length > 0 ? images : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.length > 0 ? images : undefined,
    },
  };

  if (noIndex) {
    metadata.robots = {
      index: false,
      follow: false,
    };
  }

  return metadata;
}

/**
 * Generate metadata for the home page
 */
export async function generateHomeMetadata(locale: Locale): Promise<Metadata> {
  return generatePageMetadata({
    locale,
    path: '',
    namespace: 'metadata.home',
    titleKey: 'title',
    descriptionKey: 'description',
  });
}

/**
 * Generate metadata for the experiences listing page
 */
export async function generateExperiencesMetadata(
  locale: Locale
): Promise<Metadata> {
  return generatePageMetadata({
    locale,
    path: '/experiences',
    namespace: 'metadata.experiences',
    titleKey: 'title',
    descriptionKey: 'description',
  });
}

/**
 * Generate metadata for an experience detail page
 */
export async function generateExperienceDetailMetadata(
  locale: Locale,
  slug: string,
  title: string,
  description: string,
  coverPhoto?: string
): Promise<Metadata> {
  const [t, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: 'metadata.experienceDetail' }),
    getTranslations({ locale, namespace: 'metadata' }),
  ]);

  // Truncate description to 160 characters for meta description
  const metaDescription =
    description.length > 160
      ? description.substring(0, 157) + '...'
      : description;

  const canonicalUrl = generateCanonicalUrl(locale, `/experiences/${slug}`);
  const alternates = generateAlternateLinks(`/experiences/${slug}`);
  const ogLocale = generateOgLocale(locale);

  return {
    title: t('title', { title }),
    description: metaDescription,
    alternates: {
      canonical: canonicalUrl,
      languages: alternates,
    },
    openGraph: {
      title: t('title', { title }),
      description: metaDescription,
      url: canonicalUrl,
      siteName: tMeta('siteName'),
      locale: ogLocale.locale,
      alternateLocale: ogLocale.alternateLocales,
      type: 'article',
      images: coverPhoto ? [coverPhoto] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title', { title }),
      description: metaDescription,
      images: coverPhoto ? [coverPhoto] : undefined,
    },
  };
}

/**
 * Generate metadata for the wineries listing page
 */
export async function generateWineriesMetadata(
  locale: Locale
): Promise<Metadata> {
  return generatePageMetadata({
    locale,
    path: '/wineries',
    namespace: 'metadata.wineries',
    titleKey: 'title',
    descriptionKey: 'description',
  });
}

/**
 * Generate metadata for a winery detail page
 */
export async function generateWineryDetailMetadata(
  locale: Locale,
  slug: string,
  name: string,
  description: string,
  coverPhoto?: string
): Promise<Metadata> {
  const [t, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: 'metadata.wineryDetail' }),
    getTranslations({ locale, namespace: 'metadata' }),
  ]);

  // Truncate description to 160 characters for meta description
  const metaDescription =
    description.length > 160
      ? description.substring(0, 157) + '...'
      : description;

  const canonicalUrl = generateCanonicalUrl(locale, `/wineries/${slug}`);
  const alternates = generateAlternateLinks(`/wineries/${slug}`);
  const ogLocale = generateOgLocale(locale);

  return {
    title: t('title', { name }),
    description: metaDescription,
    alternates: {
      canonical: canonicalUrl,
      languages: alternates,
    },
    openGraph: {
      title: t('title', { name }),
      description: metaDescription,
      url: canonicalUrl,
      siteName: tMeta('siteName'),
      locale: ogLocale.locale,
      alternateLocale: ogLocale.alternateLocales,
      type: 'website',
      images: coverPhoto ? [coverPhoto] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title', { name }),
      description: metaDescription,
      images: coverPhoto ? [coverPhoto] : undefined,
    },
  };
}

/**
 * Generate metadata for login page
 */
export async function generateLoginMetadata(locale: Locale): Promise<Metadata> {
  return generatePageMetadata({
    locale,
    path: '/login',
    namespace: 'metadata.login',
    titleKey: 'title',
    descriptionKey: 'description',
    noIndex: true, // Don't index auth pages
  });
}

/**
 * Generate metadata for register page
 */
export async function generateRegisterMetadata(
  locale: Locale
): Promise<Metadata> {
  return generatePageMetadata({
    locale,
    path: '/register',
    namespace: 'metadata.register',
    titleKey: 'title',
    descriptionKey: 'description',
    noIndex: true, // Don't index auth pages
  });
}
