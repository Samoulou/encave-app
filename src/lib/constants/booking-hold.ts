/**
 * Booking hold windows (P-04 / L-050, PRD US-201).
 * The 10-minute hold covers the checkout FORM phase; once the Stripe
 * session is created the hold extends to the session lifetime (Stripe
 * enforces a 30-minute minimum on Checkout Session expiry).
 */
export const HOLD_DURATION_MINUTES = 10;
export const STRIPE_SESSION_DURATION_MINUTES = 30;

/**
 * Sentinel domain for unclaimed holds' placeholder visitor email.
 * This is the ONLY discriminator between a hold and a real booking —
 * every consumer that emails/lists/counts PENDING_PAYMENT rows must go
 * through `isHoldPlaceholderEmail`, never re-hardcode the pattern.
 */
export const HOLD_EMAIL_DOMAIN = 'hold.encave.ch';

export function buildHoldPlaceholderEmail(reference: string): string {
  return `hold-${reference.toLowerCase()}@${HOLD_EMAIL_DOMAIN}`;
}

export function isHoldPlaceholderEmail(email: string): boolean {
  return email.endsWith(`@${HOLD_EMAIL_DOMAIN}`);
}
