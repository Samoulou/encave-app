'use client';

import { useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Copy, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getAttendeeEmailsForSession } from '@/server/actions/event-detail';
import { buildMailtoLink, isSafeMailtoLength } from '@/lib/utils/mailto';

interface ContactGuestsButtonProps {
  experienceId: string;
  sessionId: string;
  attendeeCount: number;
  experienceTitle: string;
  wineryName: string;
  startsAtIso: string;
}

function formatSubjectDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  }).format(date);
}

export function ContactGuestsButton({
  experienceId,
  sessionId,
  attendeeCount,
  experienceTitle,
  wineryName,
  startsAtIso,
}: ContactGuestsButtonProps) {
  const t = useTranslations('Dashboard.eventDetail.actions');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [fallbackEmails, setFallbackEmails] = useState<string[]>([]);
  const [fallbackOpen, setFallbackOpen] = useState(false);

  const disabled = attendeeCount === 0 || isPending;
  const subject = useMemo(
    () =>
      `[EnCave] ${experienceTitle} - ${formatSubjectDate(
        new Date(startsAtIso),
        locale
      )}`,
    [experienceTitle, locale, startsAtIso]
  );
  const body = useMemo(
    () => `Bonjour,\n\n[Votre message ici]\n\nA bientot,\n${wineryName}`,
    [wineryName]
  );

  const copyEmails = async () => {
    await navigator.clipboard.writeText(fallbackEmails.join(', '));
    toast.success(t('contactAllCopied'));
  };

  const handleClick = () => {
    if (disabled) return;

    startTransition(async () => {
      const result = await getAttendeeEmailsForSession({
        experienceId,
        sessionId,
      });

      if (!result.success) {
        toast.error(t('contactAllError'));
        return;
      }

      if (result.data.emails.length === 0) {
        toast.error(t('contactAllEmpty'));
        return;
      }

      const mailto = buildMailtoLink({
        to: result.data.to,
        bcc: result.data.emails,
        subject,
        body,
      });

      if (!isSafeMailtoLength(mailto)) {
        setFallbackEmails(result.data.emails);
        setFallbackOpen(true);
        return;
      }

      window.location.href = mailto;
    });
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={disabled ? 0 : -1} aria-disabled={disabled}>
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={handleClick}
              >
                <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                {isPending ? t('contactAllLoading') : t('contactAll')}
              </Button>
            </span>
          </TooltipTrigger>
          {attendeeCount === 0 ? (
            <TooltipContent>{t('contactAllEmpty')}</TooltipContent>
          ) : null}
        </Tooltip>
      </TooltipProvider>

      <Dialog open={fallbackOpen} onOpenChange={setFallbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('contactAllFallbackTitle')}</DialogTitle>
            <DialogDescription>{t('contactAllFallbackBody')}</DialogDescription>
          </DialogHeader>
          <textarea
            aria-label={t('contactAllCopy')}
            readOnly
            value={fallbackEmails.join(', ')}
            className="min-h-32 w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
          />
          <DialogFooter>
            <Button onClick={copyEmails}>
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('contactAllCopy')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
