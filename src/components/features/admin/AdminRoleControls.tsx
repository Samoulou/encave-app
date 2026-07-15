'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { UserRole } from '@prisma/client';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { changeUserRole } from '@/server/actions/admin';

interface AdminRoleControlsProps {
  targetId: string;
  currentRole: UserRole;
}

/**
 * Inline role switcher (P-15 / L-162). CLIENT ↔ WINEMAKER only — ADMIN targets
 * are read-only (managed manually). The server action enforces the same guard.
 */
export function AdminRoleControls({
  targetId,
  currentRole,
}: AdminRoleControlsProps) {
  const t = useTranslations('admin.users');
  const router = useRouter();
  const [role, setRole] = useState<'CLIENT' | 'WINEMAKER'>(
    currentRole === 'WINEMAKER' ? 'WINEMAKER' : 'CLIENT'
  );
  const [isPending, startTransition] = useTransition();

  if (currentRole === 'ADMIN') {
    return (
      <p className="text-sm text-muted-foreground">{t('adminRoleManaged')}</p>
    );
  }

  function submit() {
    startTransition(async () => {
      const result = await changeUserRole({ targetId, role });
      if (result.success) {
        toast.success(t('roleChanged'));
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={(event) =>
          setRole(event.target.value === 'WINEMAKER' ? 'WINEMAKER' : 'CLIENT')
        }
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        aria-label={t('role')}
      >
        <option value="CLIENT">CLIENT</option>
        <option value="WINEMAKER">WINEMAKER</option>
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={submit}
        disabled={isPending || role === currentRole}
      >
        {isPending ? t('saving') : t('changeRole')}
      </Button>
    </div>
  );
}
