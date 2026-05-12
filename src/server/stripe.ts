/**
 * ARCH-003 FIX: Stripe Singleton
 *
 * Single source of truth for Stripe client initialization.
 * All Stripe operations should import from this module.
 */

import Stripe from 'stripe';
import { env } from '@/lib/env';

// Initialize Stripe with optional key (for build time when env vars may not be available)
const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
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
