'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';

interface UserMenuProps {
  userName: string | null;
  userRole?: string;
}

export function UserMenu({ userName, userRole }: UserMenuProps) {
  const router = useRouter();
  const t = useTranslations('nav');

  async function handleLogout() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-slate-600">
        {t('welcome', { name: userName ?? t('user') })}
      </span>
      {userRole === 'CLIENT' && (
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/my-bookings">{t('myBookings')}</Link>
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={handleLogout}>
        {t('signOut')}
      </Button>
    </div>
  );
}
