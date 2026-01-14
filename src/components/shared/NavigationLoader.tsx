'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Global navigation loading overlay.
 * Shows a loading spinner immediately when navigation starts.
 * Disappears when the new page is ready.
 */
export function NavigationLoader() {
  return (
    <Suspense fallback={null}>
      <NavigationLoaderInner />
    </Suspense>
  );
}

function NavigationLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  // Track navigation by watching pathname/searchParams changes
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname, searchParams]);

  // Listen for click events on links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      // Skip external links, hash links, and same-page links
      if (
        href.startsWith('http') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        return;
      }

      // Skip if it's the current page
      const currentPath = window.location.pathname + window.location.search;
      if (href === currentPath) return;

      // Show loading immediately
      setIsNavigating(true);
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, []);

  if (!isNavigating) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-sm"
      role="status"
      aria-label="Loading page..."
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-burgundy-600" />
        <span className="text-sm font-medium text-slate-600">Loading...</span>
      </div>
    </div>
  );
}
