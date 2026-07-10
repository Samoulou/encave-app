'use client';

import { useTranslations } from 'next-intl';
import { NavLink } from '@/components/layout/NavLink';
import { useSession } from '@/lib/auth-client';

/**
 * Role-conditional nav link (admin / dashboard / my-bookings) of the
 * desktop header (P-06 / L-202). Client island: renders nothing until
 * the session resolves — it pops in at the END of the left-aligned nav,
 * so nothing else shifts (CLS ≈ 0).
 */
export function HeaderRoleLink() {
  const t = useTranslations('nav');
  const { data: session, isPending } = useSession();

  if (isPending || !session?.user) return null;

  const role = (session.user as { role?: string | null }).role;
  const link =
    role === 'ADMIN'
      ? { href: '/admin', label: t('admin') }
      : role === 'WINEMAKER'
        ? { href: '/dashboard', label: t('dashboard') }
        : role === 'CLIENT'
          ? { href: '/dashboard/my-bookings', label: t('myBookings') }
          : null;

  if (!link) return null;

  return (
    <NavLink
      href={link.href}
      className="whitespace-nowrap py-[23px] text-[13px] lg:text-[13.5px]"
    >
      {link.label}
    </NavLink>
  );
}
