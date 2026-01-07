'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/server/actions/auth';

interface UserMenuProps {
  userName: string | null;
}

export function UserMenu({ userName }: UserMenuProps) {
  const router = useRouter();

  async function handleLogout() {
    await logoutAction();
    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-slate-600">
        Welcome, {userName ?? 'User'}
      </span>
      <Button variant="outline" size="sm" onClick={handleLogout}>
        Sign out
      </Button>
    </div>
  );
}
