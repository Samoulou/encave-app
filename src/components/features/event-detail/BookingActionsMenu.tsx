'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { BookingStatus, NoShowChargeStatus } from '@prisma/client';
import { toast } from 'sonner';
import {
  Check,
  CreditCard,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  UserX,
} from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { formatCHF } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { chargeNoShowFee } from '@/server/actions/no-show';

type DialogKind =
  | 'markNoShow'
  | 'revertCheckIn'
  | 'revertNoShow'
  | 'chargeNoShow'
  | null;

interface BookingActionsMenuProps {
  bookingId: string;
  status: BookingStatus;
  /** Currently in the H-2 / H+2 scan window — controls the "mark present" item. */
  canCheckIn: boolean;
  /** Past session — controls the "mark no-show" item availability. */
  canMarkNoShow: boolean;
  /** P-08: total no-show fee (snapshot × guests); null when no imprint. */
  noShowFeeTotalCents?: number | null;
  /** P-08: whether a card imprint is available to charge. */
  hasNoShowImprint?: boolean;
  /** P-08: charge state — null (chargeable), CHARGED, FAILED, PENDING. */
  noShowFeeChargeStatus?: NoShowChargeStatus | null;
}

export function BookingActionsMenu({
  bookingId,
  status,
  canCheckIn,
  canMarkNoShow,
  noShowFeeTotalCents = null,
  hasNoShowImprint = false,
  noShowFeeChargeStatus = null,
}: BookingActionsMenuProps) {
  const t = useTranslations('Dashboard.eventDetail');
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [isPending, startTransition] = useTransition();

  const closeDialog = () => setDialog(null);

  const canChargeNoShow =
    status === BookingStatus.NO_SHOW &&
    hasNoShowImprint &&
    noShowFeeChargeStatus !== NoShowChargeStatus.CHARGED &&
    noShowFeeChargeStatus !== NoShowChargeStatus.PENDING &&
    (noShowFeeTotalCents ?? 0) > 0;
  const noShowAlreadyCharged =
    noShowFeeChargeStatus === NoShowChargeStatus.CHARGED;

  const runAction = (kind: Exclude<DialogKind, null> | 'markPresent') => {
    startTransition(async () => {
      const input = { bookingId };
      let toastKey:
        | 'checkedIn'
        | 'noShow'
        | 'revertedCheckIn'
        | 'revertedNoShow'
        | 'noShowCharged';
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
      } else if (kind === 'chargeNoShow') {
        result = await chargeNoShowFee(input);
        toastKey = 'noShowCharged';
      } else {
        result = await revertBookingNoShow(input);
        toastKey = 'revertedNoShow';
      }

      if (result.success) {
        toast.success(t(`toast.${toastKey}`));
        closeDialog();
        router.refresh();
      } else {
        // Surface typed messages from the server action so the user knows why.
        if (result.error.message === 'REVERT_WINDOW_EXPIRED') {
          toast.error(t('errors.revertWindowExpired'));
        } else if (result.error.message === 'SESSION_NOT_ENDED') {
          toast.error(t('errors.sessionNotEnded'));
        } else if (result.error.code === 'PAYMENT_FAILED') {
          toast.error(t('errors.noShowChargeFailed'));
        } else if (result.error.message === 'ALREADY_CHARGED') {
          toast.error(t('errors.noShowAlreadyCharged'));
        } else if (result.error.message === 'NO_SHOW_FEE_CHARGE_IN_PROGRESS') {
          toast.error(t('errors.noShowChargeInProgress'));
        } else if (result.error.message === 'BOOKING_ALREADY_TRANSITIONED') {
          toast.error(t('errors.bookingAlreadyTransitioned'));
        } else {
          toast.error(t('toast.error'));
        }
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
      case 'chargeNoShow':
        return {
          title: t('confirm.chargeNoShowTitle'),
          description: t('confirm.chargeNoShowDescription', {
            amount: formatCHF(noShowFeeTotalCents ?? 0),
          }),
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
              {!canMarkNoShow ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* span wrapper: Radix disables pointer events on
                          disabled items, blocking the tooltip without it. */}
                      <span className="block">
                        <DropdownMenuItem
                          disabled
                          onSelect={(event) => event.preventDefault()}
                        >
                          <UserX className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t('actions.markNoShow')}
                        </DropdownMenuItem>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {t('actions.markNoShowDisabled')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <DropdownMenuItem
                  disabled={isPending}
                  onSelect={(event) => {
                    event.preventDefault();
                    setDialog('markNoShow');
                  }}
                >
                  <UserX className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('actions.markNoShow')}
                </DropdownMenuItem>
              )}
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
            <>
              {canChargeNoShow ? (
                <DropdownMenuItem
                  disabled={isPending}
                  onSelect={(event) => {
                    event.preventDefault();
                    setDialog('chargeNoShow');
                  }}
                >
                  <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
                  {noShowFeeChargeStatus === NoShowChargeStatus.FAILED
                    ? t('actions.retryNoShowFee')
                    : t('actions.chargeNoShowFee', {
                        amount: formatCHF(noShowFeeTotalCents ?? 0),
                      })}
                </DropdownMenuItem>
              ) : null}
              {noShowAlreadyCharged ? (
                <DropdownMenuItem disabled>
                  <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('actions.noShowFeeCharged')}
                </DropdownMenuItem>
              ) : null}
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
            </>
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
