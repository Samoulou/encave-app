'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { anonymizeUserAsAdmin } from '@/server/actions/admin';

interface AdminAnonymizeControlsProps {
  targetId: string;
  alreadyAnonymized: boolean;
}

/**
 * Admin-initiated nLPD anonymization (P-15 / L-162). Irreversible + scrubs the
 * account, so it is gated behind an explicit confirm with a mandatory reason
 * and a per-case "notify user" checkbox.
 */
export function AdminAnonymizeControls({
  targetId,
  alreadyAnonymized,
}: AdminAnonymizeControlsProps) {
  const t = useTranslations('admin.users');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notifyUser, setNotifyUser] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (alreadyAnonymized) {
    return (
      <p className="text-sm text-muted-foreground">{t('anonymizedBadge')}</p>
    );
  }

  function submit() {
    if (reason.trim().length < 10) {
      toast.error(t('reasonTooShort'));
      return;
    }
    startTransition(async () => {
      const result = await anonymizeUserAsAdmin({ targetId, reason, notifyUser });
      if (result.success) {
        toast.success(t('anonymized'));
        setOpen(false);
        setReason('');
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <div>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={() => setOpen((value) => !value)}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {t('anonymize')}
      </Button>

      {open && (
        <div className="mt-3 space-y-3 rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-sm text-muted-foreground">
            {t('anonymizeWarning')}
          </p>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('reasonPlaceholder')}
            rows={3}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={notifyUser}
              onCheckedChange={(checked) => setNotifyUser(checked === true)}
            />
            {t('notifyUser')}
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={isPending}
            >
              {isPending ? t('saving') : t('confirmAnonymize')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
