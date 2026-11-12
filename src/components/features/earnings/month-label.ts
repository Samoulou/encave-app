import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/i18n/routing';

/**
 * Localized short month name for a 'yyyy-MM' key ("janv.", "Jan.", "Jan").
 * The earnings queries return locale-neutral keys; the label is derived
 * here, in the visitor's locale, through the shared formatters. Mid-month
 * UTC noon: immune to any timezone off-by-one when naming the month.
 */
export function monthLabelFromKey(monthKey: string, locale: Locale): string {
  const [yearPart, monthPart] = monthKey.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return monthKey;
  return formatDate(new Date(Date.UTC(year, month - 1, 15, 12)), locale, {
    month: 'short',
    day: undefined,
    year: undefined,
    timeZone: 'UTC',
  });
}
