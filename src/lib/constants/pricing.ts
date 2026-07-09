/**
 * V3 pricing constants (docs/v3/ENCAVE-V3-BUSINESS.md §2).
 * All amounts in cents (CHF).
 */

/**
 * Client booking fee per ticket, charged as a separate visible line at
 * checkout when the BOOKING_FEE flag is ON. Platform revenue — never
 * blended into the experience price, never part of the winery payout.
 */
export const BOOKING_FEE_CENTS = 250;
