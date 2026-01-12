'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console (will be captured by Sentry when configured)
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md text-center">
            {/* Error Icon */}
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-12 w-12 text-red-600" aria-hidden="true" />
            </div>

            {/* Title & Description */}
            <h1 className="text-4xl font-bold text-slate-900">
              Something went wrong
            </h1>
            <p className="mt-3 text-lg text-slate-600">
              We&apos;re sorry, an unexpected error occurred. Please try again.
            </p>

            {/* Error Digest (for debugging) */}
            {error.digest && (
              <p className="mt-4 font-mono text-xs text-slate-400">
                Error ID: {error.digest}
              </p>
            )}

            {/* Action Button */}
            <div className="mt-8">
              <button
                onClick={() => reset()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>

            {/* Support Contact */}
            <div className="mt-10 text-sm text-slate-600">
              If the problem persists, contact us at{' '}
              <a
                href="mailto:support@encave.ch"
                className="font-medium text-slate-900 underline"
              >
                support@encave.ch
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
