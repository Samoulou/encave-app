'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cancelEventSession } from '@/server/actions/event-detail';

interface CancelSessionButtonProps {
  experienceId: string;
  /** "{YYYY-MM-DD}|{HH:mm}" — the (date, timeSlot) session key. */
  sessionId: string;
}

/**
 * Cancels every CONFIRMED / PENDING_PAYMENT booking of the session with
 * full refunds and client emails (cancelEventSession). The reason is
 * required (min 10 chars server-side) and forwarded to the clients.
 */
export function CancelSessionButton({
  experienceId,
  sessionId,
}: CancelSessionButtonProps) {
  const t = useTranslations('Dashboard.eventDetail.actions');
  const [isPending, startTransition] = useTransition();

  const onCancel = () => {
    const reason = window.prompt(t('cancelSessionPrompt'));
    if (!reason) return;
    startTransition(async () => {
      const result = await cancelEventSession({
        experienceId,
        sessionId,
        reason,
      });
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={onCancel}
      className="border-red-200 text-red-700 hover:bg-red-50"
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      {t('cancelSession')}
    </Button>
  );
}
