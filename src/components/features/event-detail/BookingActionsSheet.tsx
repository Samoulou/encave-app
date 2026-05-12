'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { BookingStatus } from '@prisma/client';
import { toast } from 'sonner';
import { Check, Loader2, MoreHorizontal, RotateCcw, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  markBookingCheckedIn,
  markBookingNoShow,
  revertBookingCheckIn,
  revertBookingNoShow,
} from '@/server/actions/event-detail';
import { cn } from '@/lib/utils';

type DialogKind = 'markNoShow' | 'revertCheckIn' | 'revertNoShow' | null;

interface BookingActionsSheetProps {
  bookingId: string;
  bookingLabel: string;
  status: BookingStatus;
  canCheckIn: boolean;
  canMarkNoShow: boolean;
}

/**
 * Mobile-only bottom sheet variant of the actions menu.
 * Rendered alongside BookingActionsMenu but visible only below md breakpoint.
 */
export function BookingActionsSheet({
  bookingId,
  bookingLabel,
  status,
  canCheckIn,
  canMarkNoShow,
}: BookingActionsSheetProps) {
  const t = useTranslations('Dashboard.eventDetail');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [isPending, startTransition] = useTransition();

  if (
    status === BookingStatus.CANCELLED_BY_CLIENT ||
    status === BookingStatus.CANCELLED_BY_WINERY ||
    status === BookingStatus.PENDING_PAYMENT
  ) {
    return null;
  }

  const closeAll = () => {
    setDialog(null);
    setSheetOpen(false);
  };

  const runAction = (kind: Exclude<DialogKind, null> | 'markPresent') => {
    startTransition(async () => {
      const input = { bookingId };
      let toastKey:
        | 'checkedIn'
        | 'noShow'
        | 'revertedCheckIn'
        | 'revertedNoShow';
      let result;
      if (kind === 'markPresent') {
        result = await markBookingCheckedIn(input);
        toastKey = 'checkedIn';
      } else if (kind === 'markNoShow') {
        result = await markBookingNoShow(input);
        toastKey = 'noShow';
      } else if (kind === 'revertCheckIn') {
        result = await revertBookingCheckIn(input);
        toastKey = 'revertedCheckIn';
      } else {
        result = await revertBookingNoShow(input);
        toastKey = 'revertedNoShow';
      }
      if (result.success) {
        toast.success(t(`toast.${toastKey}`));
        closeAll();
      } else {
        toast.error(t('toast.error'));
      }
    });
  };

  const dialogCopy = (() => {
    switch (dialog) {
      case 'markNoShow':
        return {
          title: t('confirm.markNoShowTitle'),
          description: t('confirm.markNoShowDescription'),
        };
      case 'revertCheckIn':
        return {
          title: t('confirm.revertCheckInTitle'),
          description: t('confirm.revertCheckInDescription'),
        };
      case 'revertNoShow':
        return {
          title: t('confirm.revertNoShowTitle'),
          description: t('confirm.revertNoShowDescription'),
        };
      default:
        return null;
    }
  })();

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            disabled={isPending}
            aria-label={t('actions.openMenu')}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="px-4 pt-5 text-left">
            <SheetTitle className="text-base">{bookingLabel}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-2 pb-3 pt-3">
            {status === BookingStatus.CONFIRMED ? (
              <>
                <SheetAction
                  icon={<Check className="h-5 w-5" aria-hidden="true" />}
                  label={t('actions.markPresent')}
                  disabled={!canCheckIn || isPending}
                  onClick={() => runAction('markPresent')}
                />
                <SheetAction
                  icon={<UserX className="h-5 w-5" aria-hidden="true" />}
                  label={t('actions.markNoShow')}
                  disabled={!canMarkNoShow || isPending}
                  onClick={() => setDialog('markNoShow')}
                />
              </>
            ) : null}
            {status === BookingStatus.COMPLETED ? (
              <SheetAction
                icon={<RotateCcw className="h-5 w-5" aria-hidden="true" />}
                label={t('actions.revertCheckIn')}
                disabled={isPending}
                onClick={() => setDialog('revertCheckIn')}
              />
            ) : null}
            {status === BookingStatus.NO_SHOW ? (
              <SheetAction
                icon={<RotateCcw className="h-5 w-5" aria-hidden="true" />}
                label={t('actions.revertNoShow')}
                disabled={isPending}
                onClick={() => setDialog('revertNoShow')}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <AlertDialogContent>
          {dialogCopy ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{dialogCopy.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {dialogCopy.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>
                  {t('confirm.cancelCta')}
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    if (dialog) runAction(dialog);
                  }}
                >
                  {isPending ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  {t('confirm.confirmCta')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface SheetActionProps {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

function SheetAction({ icon, label, disabled, onClick }: SheetActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-900 transition-colors',
        'hover:bg-slate-100 active:bg-slate-200',
        'disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
