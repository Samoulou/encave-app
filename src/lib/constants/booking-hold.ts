/**
 * Booking hold windows (P-04 / L-050, PRD US-201).
 * The 10-minute hold covers the checkout FORM phase; once the Stripe
 * session is created the hold extends to the session lifetime (Stripe
 * enforces a 30-minute minimum on Checkout Session expiry).
 */
export const HOLD_DURATION_MINUTES = 10;
export const STRIPE_SESSION_DURATION_MINUTES = 30;
