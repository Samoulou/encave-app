/**
 * Gift card constants (P-09 / L-080→L-087, docs/v3/ENCAVE-V3-BUSINESS.md §4,
 * docs/v3/ENCAVE-V3-PRD.md US-210). All amounts in cents (CHF).
 */

/**
 * Free-amount gift bounds — 20 to 500 CHF, in 10 CHF steps (decision
 * 2026-07-12). Enforced by the validator; the configurator only offers
 * round amounts.
 */
export const GIFT_CARD_MIN_AMOUNT_CENTS = 2000;
export const GIFT_CARD_MAX_AMOUNT_CENTS = 50000;
export const GIFT_CARD_AMOUNT_STEP_CENTS = 1000;

/**
 * Fee charged at purchase, on top of the card value — a separate visible
 * line, platform revenue, no winery commission at purchase (BUSINESS §4).
 * Same 2.50 CHF as the booking fee, kept as its own constant so the two
 * can diverge without a surprise.
 */
export const GIFT_CARD_PURCHASE_FEE_CENTS = 250;

/** Legal validity of a gift card, in years (PRD US-210). */
export const GIFT_CARD_VALIDITY_YEARS = 5;

/** Max length of the personal message (fits a Stripe metadata value). */
export const GIFT_CARD_MESSAGE_MAX_LENGTH = 280;

/** Max length of a recipient/purchaser display name. */
export const GIFT_CARD_NAME_MAX_LENGTH = 80;

/**
 * ScheduledJob type for the recipient delivery email (#7), plugged into
 * the generic JOB_REGISTRY of /api/cron/process-scheduled-jobs behind the
 * GIFT_CARDS flag (mirrors TASTING_RECAP).
 */
export const GIFT_CARD_DELIVERY_JOB_TYPE = 'GIFT_CARD_DELIVERY';

/**
 * PDF / card visual variants offered by the configurator (decision
 * 2026-07-12: Noël / anniversaire / neutre).
 */
export const GIFT_CARD_VARIANTS = ['NOEL', 'ANNIVERSAIRE', 'NEUTRE'] as const;
export type GiftCardVariant = (typeof GIFT_CARD_VARIANTS)[number];

/**
 * Human-typed redemption code: Crockford-ish base32 without ambiguous
 * glyphs (no I/L/O/U, no 0/1), grouped for readability. 12 chars.
 */
export const GIFT_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const GIFT_CODE_LENGTH = 12;
export const GIFT_CODE_GROUP_SIZE = 4;
