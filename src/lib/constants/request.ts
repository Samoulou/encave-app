/**
 * Sur-mesure request constants (P-10 / L-090→L-095, docs/v3 US-240,
 * ENCAVE-V3-PAGES-EMAILS §2/§5/§8). All amounts in cents (CHF).
 *
 * Business decisions (Sam, 2026-07-13):
 * - the offer price is ALL-IN (no separate 2.50 service fee); only the
 *   winery's tier commission applies at payment.
 * - a winery is MANDATORY on the request at launch ("laissez EnCave
 *   proposer" deferred — the schema keeps wineryId nullable for later).
 * - a request left unanswered > 48h escalates to Sam by email.
 */

/** Response SLA advertised to the client and to the winery (email #8/#15). */
export const REQUEST_SLA_HOURS = 48;

/** Dashboard alert threshold: a PENDING request older than this is flagged. */
export const REQUEST_ALERT_HOURS = 24;

/** Single automatic reminder (email #10) this many hours before expiry. */
export const REQUEST_OFFER_REMINDER_LEAD_HOURS = 24;

/** Offer validity bounds the winemaker may choose, in days. */
export const REQUEST_OFFER_MIN_VALIDITY_DAYS = 1;
export const REQUEST_OFFER_MAX_VALIDITY_DAYS = 30;

/** Offer total-price bounds (cents): 20 CHF … 50'000 CHF (B2B baskets). */
export const REQUEST_OFFER_MIN_PRICE_CENTS = 2000;
export const REQUEST_OFFER_MAX_PRICE_CENTS = 5_000_000;

/** Guest-count bounds on a request (sur-mesure covers large groups). */
export const REQUEST_GUEST_MIN = 1;
export const REQUEST_GUEST_MAX = 200;

/** Indicative budget bounds (cents), optional field. */
export const REQUEST_BUDGET_MIN_CENTS = 0;
export const REQUEST_BUDGET_MAX_CENTS = 10_000_000;

/** Free-text length caps. */
export const REQUEST_DESCRIPTION_MAX_LENGTH = 2000;
export const REQUEST_DESCRIPTION_MIN_LENGTH = 10;
export const REQUEST_OFFER_MESSAGE_MAX_LENGTH = 3000;
export const REQUEST_OFFER_MESSAGE_MIN_LENGTH = 10;
export const REQUEST_NAME_MAX_LENGTH = 120;

/**
 * Reserved slug of the hidden per-winery sur-mesure holder experience
 * (Option A). Always DRAFT + `isCustom = true`; a paid offer books against
 * it. Singleton per winery via the existing @@unique([wineryId, slug]).
 */
export const SUR_MESURE_EXPERIENCE_SLUG = 'sur-mesure';

/** Default duration (minutes) of the hidden holder experience. */
export const SUR_MESURE_DEFAULT_DURATION_MIN = 120;

/**
 * Cover for the holder experience — a real committed raster asset (the
 * my-bookings card renders it with a raw <Image>, so an empty string would
 * throw). Neutral wine image; the experience is never shown in the catalogue.
 */
export const SUR_MESURE_COVER_PHOTO = '/images/herobanner-image-v2.jpg';

/**
 * ScheduledJob types plugged into the generic JOB_REGISTRY of
 * /api/cron/process-scheduled-jobs behind the REQUESTS flag (type + flag +
 * handler inseparable). No new cron entry — they ride the existing drain.
 */
export const REQUEST_OFFER_REMINDER_JOB_TYPE = 'REQUEST_OFFER_REMINDER';
export const REQUEST_OFFER_EXPIRY_JOB_TYPE = 'REQUEST_OFFER_EXPIRY';
export const REQUEST_SLA_ESCALATION_JOB_TYPE = 'REQUEST_SLA_ESCALATION';

/** Cache tag for the winemaker inbox + nav badge count (revalidated on write). */
export const REQUESTS_CACHE_TAG = 'requests';

/** dedupeKey helpers — one job per (type, entity), native idempotency. */
export function requestOfferReminderDedupeKey(offerId: string): string {
  return `${REQUEST_OFFER_REMINDER_JOB_TYPE}:${offerId}`;
}
export function requestOfferExpiryDedupeKey(offerId: string): string {
  return `${REQUEST_OFFER_EXPIRY_JOB_TYPE}:${offerId}`;
}
export function requestSlaEscalationDedupeKey(requestId: string): string {
  return `${REQUEST_SLA_ESCALATION_JOB_TYPE}:${requestId}`;
}
