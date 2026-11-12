import crypto from 'crypto';

/**
 * Capability token of a sur-mesure offer payment link
 * (`/sur-mesure/offre/{token}`), hashed at rest (pre-launch audit).
 *
 * The token is DERIVED, not random: HMAC-SHA256(server secret, offer id).
 * That is what makes hash-at-rest possible here — the link has to be
 * rebuilt long after the offer was created (reminder email #10, « mes
 * demandes » in the account), and a stored hash cannot be turned back into
 * a URL. With a derived token the database only ever needs
 * `RequestOffer.paymentTokenHash` (sha256 of the token, the platform-wide
 * scheme of src/lib/utils/token.ts): a database reader cannot forge or
 * recover a link without the server secret, while the server can always
 * re-derive it from the offer id.
 *
 * Rotating BETTER_AUTH_SECRET does not break links already emailed (the
 * lookup compares against the STORED hash), only links re-derived
 * afterwards for offers created before the rotation.
 */

const LABEL = 'encave:request-offer-payment-token:v1';

function signingSecret(): string {
  // Read from process.env on purpose (not `env`): this module is imported
  // by suites that partially mock '@/lib/env'. src/lib/env.ts already
  // refuses to boot in production without BETTER_AUTH_SECRET (≥ 32 chars).
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET is required to derive offer tokens');
  }
  return 'dev-only-offer-payment-token-secret';
}

/** Deterministic, unguessable (256-bit) payment-link token of an offer. */
export function deriveOfferPaymentToken(offerId: string): string {
  return crypto
    .createHmac('sha256', signingSecret())
    .update(`${LABEL}:${offerId}`)
    .digest('hex');
}
