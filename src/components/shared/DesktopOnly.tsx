'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface DesktopOnlyProps {
  children: ReactNode;
  /** min-width media query; defaults to Tailwind's md breakpoint. */
  query?: string;
}

/**
 * Mounts children only on viewports matching the query (L-201). CSS
 * `hidden md:block` keeps hidden React trees mounted, so heavy chunks
 * (mapbox-gl ≈ 439 kB) still download on mobile — this gate prevents
 * that by rendering nothing until the media query matches client-side.
 */
export function DesktopOnly({
  children,
  query = '(min-width: 768px)',
}: DesktopOnlyProps) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  if (!matches) {
    return null;
  }

  return <>{children}</>;
}
