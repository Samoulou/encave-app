'use client';

import dynamic from 'next/dynamic';
import { AfterIdle } from '@/components/shared/AfterIdle';

const HeaderRoleLinkInner = dynamic(
  () => import('@/components/layout/HeaderRoleLinkInner'),
  { ssr: false, loading: () => null }
);

/**
 * Role-conditional nav link (admin / dashboard / my-bookings) of the
 * desktop header (P-06 / L-202). Deferred like HeaderAuthSlot: nothing
 * renders until idle, then it pops in at the END of the left-aligned
 * nav — no layout shift, and no better-auth bytes on the LCP path.
 */
export function HeaderRoleLink() {
  return (
    <AfterIdle>
      <HeaderRoleLinkInner />
    </AfterIdle>
  );
}
