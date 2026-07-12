'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface AfterIdleProps {
  children: ReactNode;
  /** Rendered until the browser goes idle (and during SSR). */
  fallback?: ReactNode;
}

/**
 * Mounts children after the first idle period post-hydration (P-06 /
 * L-202). Companion of the header session islands: importing the
 * better-auth client eagerly dragged ~70 KiB of chunks into the entry
 * graph of every PUBLIC page and pushed the simulated LCP render delay
 * by ~3 s. Deferred children (dynamic imports inside) load after paint.
 */
export function AfterIdle({ children, fallback = null }: AfterIdleProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(() => setReady(true), {
        timeout: 1500,
      });
      return () => cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(() => setReady(true), 200);
    return () => window.clearTimeout(timer);
  }, []);

  return <>{ready ? children : fallback}</>;
}
