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

/**
 * No-show fee bounds (P-08 / US-220). Per-guest amount a winery may set when
 * it opts into no-show protection. 0–50 CHF, default 15 CHF. The DB enforces
 * the bound too (wineries_no_show_fee_bounds CHECK, P-02).
 */
export const NO_SHOW_FEE_MIN_CENTS = 0;
export const NO_SHOW_FEE_MAX_CENTS = 5000;
export const NO_SHOW_FEE_DEFAULT_CENTS = 1500;
