'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';

interface UserMenuProps {
  userName: string | null;
}

export function UserMenu({ userName }: UserMenuProps) {
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
      <Button variant="outline" size="sm" onClick={handleLogout}>
        {t('signOut')}
      </Button>
    </div>
  );
}
