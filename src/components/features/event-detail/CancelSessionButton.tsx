'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cancelEventSession } from '@/server/actions/event-detail';

/** Mirror of the server-side minimum (cancelEventSession validator). */
const REASON_MIN_LENGTH = 10;

interface CancelSessionButtonProps {
  experienceId: string;
  /** "{YYYY-MM-DD}|{HH:mm}" — the (date, timeSlot) session key. */
  sessionId: string;
}

/**
 * Cancels every CONFIRMED / PENDING_PAYMENT booking of the session with
 * full refunds and client emails (cancelEventSession). The reason is
 * captured in a proper dialog (P-05 debt: was a window.prompt), required
 * (min 10 chars, mirrored server-side) and forwarded to the clients.
 */
export function CancelSessionButton({
  experienceId,
  sessionId,
}: CancelSessionButtonProps) {
  const t = useTranslations('Dashboard.eventDetail.actions');
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const reasonTooShort = reason.trim().length < REASON_MIN_LENGTH;

  const onConfirm = () => {
    const trimmed = reason.trim();
    if (trimmed.length < REASON_MIN_LENGTH) return;
    startTransition(async () => {
      const result = await cancelEventSession({
        experienceId,
        sessionId,
        reason: trimmed,
      });
      setOpen(false);
      setReason('');
      if (!result.success) {
        toast.error(t('cancelSessionError'));
        return;
      }
      if (result.data.failed > 0) {
        toast.error(t('cancelSessionPartial', { count: result.data.failed }));
        return;
      }
      toast.success(t('cancelSessionDone'));
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => setOpen(true)}
        className="border-red-200 text-red-700 hover:bg-red-50"
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {t('cancelSession')}
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!isPending) setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelSessionTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('cancelSessionDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-session-reason">
              {t('cancelSessionReasonLabel')}
            </Label>
            <Textarea
              id="cancel-session-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('cancelSessionReasonPlaceholder')}
              rows={3}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              {t('cancelSessionReasonHint', { min: REASON_MIN_LENGTH })}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t('cancelSessionBack')}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={isPending || reasonTooShort}
            >
              {isPending && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {t('cancelSessionConfirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
