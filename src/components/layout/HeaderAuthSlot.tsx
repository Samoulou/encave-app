'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/features/auth/UserMenu';
import { useSession } from '@/lib/auth-client';

/**
 * Session cluster of the desktop header (P-06 / L-202). Client island:
 * the header itself renders statically (ISR) and the session resolves
 * here after hydration. While pending we show neutral skeleton pills —
 * never the logged-out buttons — so a signed-in user gets no
 * « Se connecter » flash. Sized like the real clusters: CLS ≈ 0.
 */
export function HeaderAuthSlot() {
  const t = useTranslations('nav');
  const { data: session, isPending } = useSession();

  if (isPending) {
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

  if (session?.user) {
    const user = session.user as typeof session.user & {
      role?: string | null;
    };
    return (
      <UserMenu
        userName={user.name ?? null}
        userRole={user.role}
        userEmail={user.email}
      />
    );
  }

  return (
    <div className="flex items-center gap-2 lg:gap-3">
      <Button
        variant="outline"
        className="h-9 rounded-full border-stone-200 px-3 text-[12.5px] font-semibold text-ink-900 lg:px-4"
        asChild
      >
        <Link href="/login">{t('signIn')}</Link>
      </Button>
      <Button
        className="h-9 rounded-full bg-burgundy-600 px-3 text-[12.5px] font-semibold text-white hover:bg-burgundy-700 lg:px-4"
        asChild
      >
        <Link href="/register">{t('getStarted')}</Link>
      </Button>
    </div>
  );
}
