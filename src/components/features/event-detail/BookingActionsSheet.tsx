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
import { chargeNoShowFee } from '@/server/actions/no-show';
import { cn } from '@/lib/utils';

type DialogKind =
  | 'markNoShow'
  | 'revertCheckIn'
  | 'revertNoShow'
  | 'chargeNoShow'
  | null;

interface BookingActionsSheetProps {
  bookingId: string;
  bookingLabel: string;
  status: BookingStatus;
  canCheckIn: boolean;
  canMarkNoShow: boolean;
  noShowFeeTotalCents?: number | null;
  hasNoShowImprint?: boolean;
  noShowFeeChargeStatus?: NoShowChargeStatus | null;
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
  noShowFeeTotalCents = null,
  hasNoShowImprint = false,
  noShowFeeChargeStatus = null,
}: BookingActionsSheetProps) {
  const t = useTranslations('Dashboard.eventDetail');
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [isPending, startTransition] = useTransition();

  const canChargeNoShow =
    status === BookingStatus.NO_SHOW &&
    hasNoShowImprint &&
    noShowFeeChargeStatus !== NoShowChargeStatus.CHARGED &&
    noShowFeeChargeStatus !== NoShowChargeStatus.PENDING &&
    (noShowFeeTotalCents ?? 0) > 0;
  const noShowAlreadyCharged =
    noShowFeeChargeStatus === NoShowChargeStatus.CHARGED;

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
        closeAll();
        router.refresh();
      } else {
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
              <>
                {canChargeNoShow ? (
                  <SheetAction
                    icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
                    label={
                      noShowFeeChargeStatus === NoShowChargeStatus.FAILED
                        ? t('actions.retryNoShowFee')
                        : t('actions.chargeNoShowFee', {
                            amount: formatCHF(noShowFeeTotalCents ?? 0),
                          })
                    }
                    disabled={isPending}
                    onClick={() => setDialog('chargeNoShow')}
                  />
                ) : null}
                {noShowAlreadyCharged ? (
                  <SheetAction
                    icon={<Check className="h-5 w-5" aria-hidden="true" />}
                    label={t('actions.noShowFeeCharged')}
                    disabled
                    onClick={() => undefined}
                  />
                ) : null}
                <SheetAction
                  icon={<RotateCcw className="h-5 w-5" aria-hidden="true" />}
                  label={t('actions.revertNoShow')}
                  disabled={isPending}
                  onClick={() => setDialog('revertNoShow')}
                />
              </>
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
        'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-foreground transition-colors',
        'hover:bg-muted active:bg-accent',
        'disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
