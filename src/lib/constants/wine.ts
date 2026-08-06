/**
 * Wine catalogue + tasting loop bounds (P-07).
 */

export const WINE_NAME_MAX_LENGTH = 120;
export const WINE_GRAPE_MAX_LENGTH = 120;
/** 5000 CHF — generous ceiling for a bottle, in cents. */
export const WINE_PRICE_MAX_CENTS = 500_000;
export const WINE_VINTAGE_MIN = 1900;

/** Upper bound of wines togglable on one tasting sheet. */
export const TASTING_SHEET_MAX_WINES = 100;

/** Wine-order request bounds (J+2 recap CTA). */
export const WINE_ORDER_MAX_ITEMS = 50;
export const WINE_ORDER_MAX_QUANTITY = 99;

/** Hours between the session end and the "coups de cœur" email (J+2). */
export const TASTING_RECAP_DELAY_HOURS = 48;

/** ScheduledJob.type of the J+2 recap (one job per booking). */
export const TASTING_RECAP_JOB_TYPE = 'TASTING_RECAP';

/** dedupeKey of a booking's recap job — the "recap armed" marker (D4). */
export function tastingRecapDedupeKey(bookingId: string): string {
  return `${TASTING_RECAP_JOB_TYPE}:${bookingId}`;
}

/** Max delivery attempts before a scheduled job goes FAILED. */
export const SCHEDULED_JOB_MAX_ATTEMPTS = 5;
