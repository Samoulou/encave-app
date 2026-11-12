'use client';

import { useEffect } from 'react';
import { useSession } from '@/lib/auth-client';
import { onSentryReady } from '@/lib/sentry-client';

/**
 * Syncs the authenticated user to Sentry for error context.
 * Sets user on login, clears on logout.
 */
export function SentryUserSync() {
  const { data: session } = useSession();
  const user = session?.user;

  useEffect(() => {
    // The SDK is deferred (src/lib/sentry-client.ts): tag the user once it
    // is ready instead of importing it into the initial bundle.
    onSentryReady((Sentry) => {
      if (user) {
        Sentry.setUser({
          id: user.id,
          email: user.email,
          // role is an additionalField on the session
          data: { role: (user as Record<string, unknown>).role },
        });
      } else {
        Sentry.setUser(null);
      }
    });
  }, [user]);

  return null;
}
