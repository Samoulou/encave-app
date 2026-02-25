'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useSession } from '@/lib/auth-client';

/**
 * Initializes PostHog client-side analytics (EU-hosted for nLPD compliance).
 * - Auto-captures pageviews and pageleaves
 * - Identifies authenticated users (aligned with Sentry.setUser)
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') {
          ph.debug();
        }
      },
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

/**
 * Syncs authenticated user identity to PostHog.
 * Placed alongside SentryUserSync — both use user.id as the identifier.
 */
export function PostHogUserSync() {
  const { data: session } = useSession();
  const user = session?.user;

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        role: (user as Record<string, unknown>).role,
      });
    } else {
      posthog.reset();
    }
  }, [user]);

  return null;
}
