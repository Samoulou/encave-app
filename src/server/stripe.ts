/**
 * ARCH-003 FIX: Stripe Singleton
 *
 * Single source of truth for Stripe client initialization.
 * All Stripe operations should import from this module.
 */

import Stripe from 'stripe';
import { env } from '@/lib/env';

/**
 * Explicit network budget. The SDK default is an 80 s timeout per attempt:
 * during a Stripe brown-out a checkout server action or a webhook would
 * sit there until the platform kills the function — and a killed webhook
 * leaves its StripeEvent stuck in PROCESSING. 20 s is far above Stripe's
 * normal latency (p99 well under 5 s) and leaves room for the retries
 * inside one function invocation.
 *
 * Retries are safe: stripe-node sends an Idempotency-Key automatically on
 * retried POSTs, and only retries connection errors, 409 and 5xx/429.
 */
export const STRIPE_TIMEOUT_MS = 20_000;
export const STRIPE_MAX_NETWORK_RETRIES = 2;

// Initialize Stripe with optional key (for build time when env vars may not be available)
const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
      timeout: STRIPE_TIMEOUT_MS,
      maxNetworkRetries: STRIPE_MAX_NETWORK_RETRIES,
    })
  : null;

/**
 * Get the Stripe instance, throwing if not configured.
 * Use this when Stripe is required for the operation to succeed.
 */
export function getStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      'Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.'
    );
  }
  return stripe;
}

/**
 * Check if Stripe is configured.
 * Use this for optional Stripe operations or graceful degradation.
 */
export function isStripeConfigured(): boolean {
  return stripe !== null;
}

export { stripe };
