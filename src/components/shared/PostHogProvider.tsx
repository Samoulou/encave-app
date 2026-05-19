'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useSession } from '@/lib/auth-client';
import { CONSENT_COOKIE_NAME, CONSENT_VERSION } from '@/lib/constants/consent';

interface ConsentCookie {
  analytics: boolean;
  version: string;
}

function readConsent(): ConsentCookie | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CONSENT_COOKIE_NAME}=`))
    ?.split('=')[1];
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as ConsentCookie;
  } catch {
    return null;
  }
}

function initPostHogFromConsent(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const consent = readConsent();
  if (!key || !consent?.analytics || consent.version !== CONSENT_VERSION)
    return;
  if (posthog.__loaded) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
  });
}

/**
 * Provides PostHog React context (EU-hosted for nLPD compliance).
 * Init happens at module level above — this just provides the context.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHogFromConsent();
    window.addEventListener('encave-consent-updated', initPostHogFromConsent);
    return () => {
      window.removeEventListener(
        'encave-consent-updated',
        initPostHogFromConsent
      );
    };
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
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !posthog.__loaded) return;

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
