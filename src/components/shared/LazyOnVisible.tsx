'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface LazyOnVisibleProps {
  children: ReactNode;
  /** Placeholder shown until the container approaches the viewport. */
  fallback?: ReactNode;
  /** IntersectionObserver rootMargin — default preloads one screen early. */
  rootMargin?: string;
  className?: string;
}

/**
 * Mounts children only once their container approaches the viewport
 * (P-06 / L-201, sibling of DesktopOnly). The detail pages' maps sit
 * below the fold: without this gate the maplibre-gl chunk (~439 kB)
 * downloads on every mobile fiche load even when the visitor never
 * scrolls to the map.
 */
export function LazyOnVisible({
  children,
  fallback = null,
  rootMargin = '200px',
  className,
}: LazyOnVisibleProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || isVisible) return;

    // No IntersectionObserver (ancient browser): mount immediately —
    // correctness over the optimization.
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  return (
    <div ref={containerRef} className={className}>
      {isVisible ? children : fallback}
    </div>
  );
}
