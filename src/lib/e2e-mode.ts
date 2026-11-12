/**
 * Single source of truth for the E2E simulation switch (fake Stripe
 * sessions, disabled rate limits, k6 test route).
 *
 * `E2E_TEST=true` must NEVER take effect on the production deployment: one
 * stray variable would otherwise disable every rate limit and skip Stripe.
 * Two independent guards:
 *  - here: the helper answers false whenever VERCEL_ENV is 'production';
 *  - src/lib/env.ts: the combination throws at boot.
 *
 * Dependency-free on purpose (read at call time, safe from any runtime):
 * always use this helper, never a raw `process.env.E2E_TEST` read.
 */
export function isE2ETest(): boolean {
  return (
    process.env.E2E_TEST === 'true' && process.env.VERCEL_ENV !== 'production'
  );
}
