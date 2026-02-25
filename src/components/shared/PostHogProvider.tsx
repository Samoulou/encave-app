'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useSession } from '@/lib/auth-client';

// Initialize PostHog at module level (before any component renders)
// so that posthog.capture() works in all client components.
if (typeof window !== 'undefined') {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (key) {
    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
    });
  }
}

/**
 * Provides PostHog React context (EU-hosted for nLPD compliance).
 * Init happens at module level above — this just provides the context.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
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
