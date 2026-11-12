'use client';

import { useEffect } from 'react';
import { loadSentryClient } from '@/lib/sentry-client';

/**
 * Report an error caught by a route `error.tsx` boundary to Sentry.
 *
 * A boundary SWALLOWS the error — the global handlers never see it — and
 * the boundaries only did a `console.error`, i.e. nothing in production.
 * The browser SDK is deferred (src/lib/sentry-client.ts): it is loaded on
 * demand here, never through a static `@sentry/nextjs` import in a client
 * file. Best-effort: no DSN / blocked chunk resolves to a no-op.
 */
export function useReportBoundaryError(
  error: Error & { digest?: string },
  boundary: string
): void {
  useEffect(() => {
    void loadSentryClient().then((Sentry) => {
      Sentry?.captureException(error, {
        tags: { boundary },
        extra: { digest: error.digest },
      });
    });
  }, [error, boundary]);
}
