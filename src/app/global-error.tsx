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
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}
      >
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            padding: '0 1rem',
          }}
        >
          <div style={{ width: '100%', maxWidth: '28rem', textAlign: 'center' }}>
            <div
              style={{
                margin: '0 auto 1.5rem',
                display: 'flex',
                height: '6rem',
                width: '6rem',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '9999px',
                backgroundColor: '#fee2e2',
              }}
            >
              <AlertTriangle
                style={{ height: '3rem', width: '3rem', color: '#dc2626' }}
                aria-hidden="true"
              />
            </div>

            <h1
              style={{
                fontSize: '2.25rem',
                fontWeight: 700,
                color: '#0f172a',
                margin: 0,
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                marginTop: '0.75rem',
                fontSize: '1.125rem',
                color: '#475569',
              }}
            >
              We&apos;re sorry, an unexpected error occurred. Please try again.
            </p>

            {error.digest && (
              <p
                style={{
                  marginTop: '1rem',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                }}
              >
                Error ID: {error.digest}
              </p>
            )}

            <div style={{ marginTop: '2rem' }}>
              <button
                onClick={() => reset()}
                style={{
                  display: 'inline-flex',
                  height: '2.75rem',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#0f172a',
                  padding: '0 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw style={{ height: '1rem', width: '1rem' }} />
                Try again
              </button>
            </div>

            <div
              style={{
                marginTop: '2.5rem',
                fontSize: '0.875rem',
                color: '#475569',
              }}
            >
              If the problem persists, contact us at{' '}
              <a
                href="mailto:support@encave.ch"
                style={{
                  fontWeight: 500,
                  color: '#0f172a',
                  textDecoration: 'underline',
                }}
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
