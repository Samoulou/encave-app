import type { PostHog } from 'posthog-js';
import { hasAnalyticsConsent } from '@/lib/consent-client';

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

/**
 * Lazily loads and initializes posthog-js (L-204).
 * The library is dynamically imported ONLY once analytics consent is granted,
 * so it never ships in the initial bundle. Resolves to null when consent is
 * missing, no key is configured, or we are on the server.
 */
export function initPostHogFromConsent(): Promise<PostHog | null> {
  if (client) return Promise.resolve(client);

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || !hasAnalyticsConsent()) {
    return Promise.resolve(null);
  }

  if (!loading) {
    loading = import('posthog-js')
      .then(({ default: posthog }) => {
        if (!posthog.__loaded) {
          posthog.init(key, {
            api_host:
              process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
            capture_pageview: true,
            capture_pageleave: true,
            persistence: 'localStorage+cookie',
          });
        }
        client = posthog;
        return client;
      })
      .catch(() => {
        // Chunk load failed (offline, ad-blocker) — allow a later retry.
        loading = null;
        return null;
      });
  }

  return loading;
}

/** Returns the initialized PostHog client, or null before consent/init. */
export function getPostHogClient(): PostHog | null {
  return client;
}

/**
 * Consent-safe capture. No-op when PostHog is not initialized (no consent),
 * mirroring posthog-js' own pre-init behavior. Events fired while the lazy
 * chunk is still loading are delivered once init completes.
 */
export function capturePostHog(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (client) {
    client.capture(event, properties);
    return;
  }
  if (loading) {
    void loading.then((posthog) => posthog?.capture(event, properties));
  }
}
