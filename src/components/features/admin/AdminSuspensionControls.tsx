'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Ban, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  suspendUser,
  suspendWinery,
  reinstateUser,
  reinstateWinery,
} from '@/server/actions/admin';

type TargetType = 'user' | 'winery';
type Mode = 'suspend' | 'reinstate';

interface AdminSuspensionControlsProps {
  targetId: string;
  targetType: TargetType;
  mode: Mode;
  label: string;
}

export function AdminSuspensionControls({
  targetId,
  targetType,
  mode,
  label,
}: AdminSuspensionControlsProps) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isSuspend = mode === 'suspend';

  function submit() {
    if (reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters.');
      return;
    }

    const action =
      targetType === 'winery'
        ? isSuspend
          ? suspendWinery
          : reinstateWinery
        : isSuspend
          ? suspendUser
          : reinstateUser;

    startTransition(async () => {
      const result = await action({ targetId, reason });
      if (result.success) {
        toast.success(isSuspend ? 'Suspension saved.' : 'Reinstatement saved.');
        setOpen(false);
        setReason('');
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">
            {isSuspend
              ? 'Blocks access and records an admin action.'
              : 'Restores access and records an admin action.'}
          </p>
        </div>
        <Button
          type="button"
          variant={isSuspend ? 'destructive' : 'outline'}
          onClick={() => setOpen((value) => !value)}
        >
          {isSuspend ? (
            <Ban className="mr-2 h-4 w-4" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          {isSuspend ? 'Suspend' : 'Reinstate'}
        </Button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Operational reason visible in AdminAction logs"
            rows={3}
          />
          <div className="flex gap-2">
            <Button type="button" onClick={submit} disabled={isPending}>
              {isPending ? 'Saving...' : 'Confirm'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
