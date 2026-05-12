import { type Locale } from '@/i18n/routing';

/**
 * Map our locale codes to BCP 47 locale tags for Swiss locales
 */
export const LOCALE_MAP: Record<Locale, string> = {
  fr: 'fr-CH',
  de: 'de-CH',
  en: 'en-CH',
} as const;

/**
 * Formats a date in a locale-aware manner
 * @param date - The date to format
 * @param locale - The locale to use for formatting
 * @param options - Optional Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // If dateStyle or timeStyle is provided, don't use default component options
  // as they are mutually exclusive with individual date/time components
  const finalOptions: Intl.DateTimeFormatOptions =
    options?.dateStyle || options?.timeStyle
      ? options
      : {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          ...options,
        };

  return new Intl.DateTimeFormat(LOCALE_MAP[locale], finalOptions).format(
    dateObj
  );
}

/**
 * Formats a date in short format (e.g., "10 Jan 2026")
 */
export function formatDateShort(date: Date | string, locale: Locale): string {
  return formatDate(date, locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Formats a time in locale-aware manner
 * @param date - The date/time to format
 * @param locale - The locale to use for formatting
 * @returns Formatted time string (e.g., "14:30")
 */
export function formatTime(date: Date | string, locale: Locale): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat(LOCALE_MAP[locale], {
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}

/**
 * Formats a date and time together
 */
export function formatDateTime(date: Date | string, locale: Locale): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat(LOCALE_MAP[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}

/**
 * Formats a number in locale-aware manner
 * @param value - The number to format
 * @param locale - The locale to use for formatting
 * @param options - Optional Intl.NumberFormatOptions
 * @returns Formatted number string
 */
export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(LOCALE_MAP[locale], options).format(value);
}

/**
 * Formats a price in Swiss Francs (CHF)
 * Always uses consistent CHF X.XX format across all locales
 * @param amount - The amount in CHF
 * @returns Formatted price string (e.g., "CHF 45.00")
 */
export function formatPrice(amount: number): string {
  // Use fr-CH format for consistent "CHF X.XX" across all locales
  return new Intl.NumberFormat('fr-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a price without currency symbol
 * @param amount - The amount
 * @returns Formatted number string (e.g., "45.00")
 */
export function formatPriceValue(amount: number): string {
  return new Intl.NumberFormat('fr-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a duration in hours/minutes
 * @param minutes - Duration in minutes
 * @param locale - The locale for formatting
 * @returns Object with hours and minutes for use with translation
 */
export function formatDuration(minutes: number): {
  hours: number;
  mins: number;
} {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return { hours, mins };
}

/**
 * Formats a relative time (e.g., "2 hours ago")
 * @param date - The date to compare
 * @param locale - The locale for formatting
 * @returns Object with count and unit for use with translation
 */
export function getRelativeTime(date: Date | string): {
  count: number;
  unit: 'minutes' | 'hours' | 'days';
} {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return { count: diffDays, unit: 'days' };
  } else if (diffHours > 0) {
    return { count: diffHours, unit: 'hours' };
  } else {
    return { count: Math.max(1, diffMinutes), unit: 'minutes' };
  }
}
