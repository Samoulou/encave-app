/**
 * Sur-mesure offer payment-link token — derived (HMAC of the offer id with
 * the server secret) so only its sha256 has to be stored (hash at rest,
 * pre-launch audit) while the link stays rebuildable server-side.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deriveOfferPaymentToken } from '@/lib/utils/offer-payment-token';

describe('deriveOfferPaymentToken', () => {
  const original = {
    secret: process.env.BETTER_AUTH_SECRET,
    nodeEnv: process.env.NODE_ENV,
  };

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = 'unit-secret-0123456789abcdef0123456789';
  });

  afterEach(() => {
    if (original.secret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = original.secret;
    Object.assign(process.env, { NODE_ENV: original.nodeEnv });
  });

  it('is a 256-bit hex token accepted by the offer-checkout validator (16–128 chars)', () => {
    const token = deriveOfferPaymentToken('offer-1');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for an offer — the link can be rebuilt at any time', () => {
    expect(deriveOfferPaymentToken('offer-1')).toBe(
      deriveOfferPaymentToken('offer-1')
    );
  });

  it('differs per offer', () => {
    expect(deriveOfferPaymentToken('offer-1')).not.toBe(
      deriveOfferPaymentToken('offer-2')
    );
  });

  it('cannot be computed without the server secret', () => {
    const withSecretA = deriveOfferPaymentToken('offer-1');
    process.env.BETTER_AUTH_SECRET = 'another-secret-0123456789abcdef012345';
    expect(deriveOfferPaymentToken('offer-1')).not.toBe(withSecretA);
  });

  it('refuses to fall back to the dev secret in production', () => {
    delete process.env.BETTER_AUTH_SECRET;
    Object.assign(process.env, { NODE_ENV: 'production' });
    expect(() => deriveOfferPaymentToken('offer-1')).toThrow(
      /BETTER_AUTH_SECRET/
    );
  });

  it('still works without a secret outside production (local dev / tests)', () => {
    delete process.env.BETTER_AUTH_SECRET;
    Object.assign(process.env, { NODE_ENV: 'test' });
    expect(deriveOfferPaymentToken('offer-1')).toMatch(/^[0-9a-f]{64}$/);
  });
});
