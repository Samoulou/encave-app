'use client';

import dynamic from 'next/dynamic';
import { AfterIdle } from '@/components/shared/AfterIdle';

/**
 * Session cluster of the desktop header (P-06 / L-202). The header
 * renders statically (ISR); the session resolves entirely client-side,
 * and DEFERRED: the better-auth client (+UserMenu) lives in an async
 * chunk mounted after the first idle — off the LCP critical path.
 * Until then (and while the session resolves) neutral skeleton pills:
 * a signed-in user never sees a « Se connecter » flash. CLS ≈ 0.
 */

export function HeaderAuthSkeleton() {
  return (
    <div
      className="flex items-center gap-2 lg:gap-3"
      aria-hidden="true"
      data-testid="header-auth-skeleton"
    >
      <div className="h-9 w-20 animate-pulse rounded-full bg-stone-200/70 lg:w-24" />
      <div className="h-9 w-24 animate-pulse rounded-full bg-stone-200/70 lg:w-28" />
    </div>
  );
}

const HeaderAuthCluster = dynamic(
  () => import('@/components/layout/HeaderAuthCluster'),
  { ssr: false, loading: () => <HeaderAuthSkeleton /> }
);

export function HeaderAuthSlot() {
  return (
    <AfterIdle fallback={<HeaderAuthSkeleton />}>
      <HeaderAuthCluster />
    </AfterIdle>
  );
}
