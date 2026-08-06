'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/features/auth/UserMenu';
import { useSession } from '@/lib/auth-client';
import { HeaderAuthSkeleton } from '@/components/layout/HeaderAuthSlot';

/**
 * The real session cluster — ONLY reached through the dynamic import in
 * HeaderAuthSlot so the better-auth client stays out of the entry
 * chunk graph of the public pages (P-06 / L-202).
 */
export default function HeaderAuthCluster() {
  const t = useTranslations('nav');
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <HeaderAuthSkeleton />;
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
