'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useSession } from '@/lib/auth-client';

/**
 * Syncs the authenticated user to Sentry for error context.
 * Sets user on login, clears on logout.
 */
export function SentryUserSync() {
  const { data: session } = useSession();
  const user = session?.user;

  useEffect(() => {
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
  }, [user]);

  return null;
}
