'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { BookingStatus } from '@prisma/client';
import { toast } from 'sonner';
import { Check, Loader2, MoreHorizontal, RotateCcw, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

type DialogKind = 'markNoShow' | 'revertCheckIn' | 'revertNoShow' | null;

interface BookingActionsMenuProps {
  bookingId: string;
  status: BookingStatus;
  /** Currently in the H-2 / H+2 scan window — controls the "mark present" item. */
  canCheckIn: boolean;
  /** Past session — controls the "mark no-show" item availability. */
  canMarkNoShow: boolean;
}

export function BookingActionsMenu({
  bookingId,
  status,
  canCheckIn,
  canMarkNoShow,
}: BookingActionsMenuProps) {
  const t = useTranslations('Dashboard.eventDetail');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [isPending, startTransition] = useTransition();

  const closeDialog = () => setDialog(null);

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
        closeDialog();
      } else {
        toast.error(t('toast.error'));
      }
    });
  };

  // No actions available
  if (
    status === BookingStatus.CANCELLED_BY_CLIENT ||
    status === BookingStatus.CANCELLED_BY_WINERY ||
    status === BookingStatus.PENDING_PAYMENT
  ) {
    return null;
  }

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isPending}
            aria-label={t('actions.openMenu')}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {status === BookingStatus.CONFIRMED ? (
            <>
              <DropdownMenuItem
                disabled={!canCheckIn || isPending}
                onSelect={(event) => {
                  event.preventDefault();
                  runAction('markPresent');
                }}
              >
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('actions.markPresent')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canMarkNoShow || isPending}
                onSelect={(event) => {
                  event.preventDefault();
                  setDialog('markNoShow');
                }}
              >
                <UserX className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('actions.markNoShow')}
              </DropdownMenuItem>
            </>
          ) : null}

          {status === BookingStatus.COMPLETED ? (
            <DropdownMenuItem
              disabled={isPending}
              onSelect={(event) => {
                event.preventDefault();
                setDialog('revertCheckIn');
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('actions.revertCheckIn')}
            </DropdownMenuItem>
          ) : null}

          {status === BookingStatus.NO_SHOW ? (
            <DropdownMenuItem
              disabled={isPending}
              onSelect={(event) => {
                event.preventDefault();
                setDialog('revertNoShow');
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('actions.revertNoShow')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
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
