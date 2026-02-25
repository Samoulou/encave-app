import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

/**
 * Server-side PostHog client for tracking events from server actions
 * and webhooks (e.g. booking_completed, producer_onboarded).
 *
 * Uses flushAt=1 for serverless environments (Vercel) to ensure events
 * are sent before the function terminates.
 *
 * Returns null if NEXT_PUBLIC_POSTHOG_KEY is not configured.
 */
export function getPostHogServer(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  if (!posthogClient) {
    posthogClient = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return posthogClient;
}
