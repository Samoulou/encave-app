import type { Locale } from '@prisma/client';

/**
 * Map Prisma Locale enum to BCP 47 locale tags for Swiss locales
 */
const PRISMA_LOCALE_MAP: Record<Locale, string> = {
  FR: 'fr-CH',
  DE: 'de-CH',
  EN: 'en-CH',
} as const;

/**
 * Format a date for email display with full weekday and date
 */
export function formatEmailDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(PRISMA_LOCALE_MAP[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Format a short date for email display (without weekday)
 */
export function formatEmailDateShort(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(PRISMA_LOCALE_MAP[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Format time for email display
 */
export function formatEmailTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(PRISMA_LOCALE_MAP[locale], {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format price in CHF for email display
 */
export function formatEmailPrice(amount: number): string {
  return new Intl.NumberFormat('fr-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(amount / 100); // Convert from cents
}

/**
 * Format duration in hours/minutes for email display
 */
export function formatEmailDuration(minutes: number, locale: Locale): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const labels: Record<Locale, { hour: string; hours: string; min: string }> = {
    FR: { hour: 'heure', hours: 'heures', min: 'min' },
    DE: { hour: 'Stunde', hours: 'Stunden', min: 'Min' },
    EN: { hour: 'hour', hours: 'hours', min: 'min' },
  };

  const l = labels[locale];

  if (hours === 0) {
    return `${mins} ${l.min}`;
  }
  if (mins === 0) {
    return `${hours} ${hours === 1 ? l.hour : l.hours}`;
  }
  return `${hours} ${hours === 1 ? l.hour : l.hours} ${mins} ${l.min}`;
}

/**
 * Format guest count with pluralization
 */
export function formatEmailGuests(count: number, locale: Locale): string {
  const labels: Record<Locale, { singular: string; plural: string }> = {
    FR: { singular: 'personne', plural: 'personnes' },
    DE: { singular: 'Person', plural: 'Personen' },
    EN: { singular: 'guest', plural: 'guests' },
  };

  const l = labels[locale];
  return `${count} ${count === 1 ? l.singular : l.plural}`;
}
