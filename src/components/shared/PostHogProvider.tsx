'use client';

import { useEffect } from 'react';
import { useSession } from '@/lib/auth-client';
import { getPostHogClient, initPostHogFromConsent } from '@/lib/posthog-client';

/**
 * Initializes PostHog (EU-hosted for nLPD compliance) once analytics consent
 * is granted. posthog-js is dynamically imported inside the consent-gated
 * init path (L-204), so it never ships in the initial bundle.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const init = () => void initPostHogFromConsent();
    init();
    window.addEventListener('encave-consent-updated', init);
    return () => {
      window.removeEventListener('encave-consent-updated', init);
    };
  }, []);

  return <>{children}</>;
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
      // Consent-gated: resolves null (no-op) when analytics consent is absent.
      void initPostHogFromConsent().then((posthog) => {
        posthog?.identify(user.id, {
          email: user.email,
          role: (user as Record<string, unknown>).role,
        });
      });
    } else {
      // Only reset an already-initialized client — never load PostHog for it.
      getPostHogClient()?.reset();
    }
  }, [user]);

  return null;
}
