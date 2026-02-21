'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cancelBooking, getCancellationInfo } from '@/server/actions/booking';
import { toast } from 'sonner';
import { formatCHF } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  accessToken: string;
  totalPrice: number;
}

export function CancellationModal({
  isOpen,
  onClose,
  bookingId,
  accessToken,
  totalPrice,
}: CancellationModalProps) {
  const t = useTranslations('cancellation');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationInfo, setCancellationInfo] = useState<{
    canCancel: boolean;
    isEligibleForRefund: boolean;
    hoursUntilExperience: number;
    refundAmount: number;
    reason?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsConfirmed(false);
      setIsLoading(true);
      getCancellationInfo(bookingId, accessToken).then((result) => {
        if (result.success) {
          setCancellationInfo(result.data);
        }
        setIsLoading(false);
      });
    }
  }, [isOpen, bookingId, accessToken]);

  const handleCancel = async () => {
    if (!isConfirmed) return;

    setIsCancelling(true);
    try {
      const result = await cancelBooking(bookingId, accessToken);

      if (result.success) {
        toast.success(t('cancelled'), {
          description: result.data.refundIssued
            ? t('refundProcessed', { amount: formatCHF(result.data.refundAmount ?? 0) })
            : t('cancelledDescription'),
        });
        onClose();
        router.refresh();
      } else {
        toast.error(t('cancelError'));
      }
    } catch {
      toast.error(t('cancelError'));
    } finally {
      setIsCancelling(false);
    }
  };

  const hours = Math.floor(cancellationInfo?.hoursUntilExperience ?? 0);
  const minutes = Math.round(((cancellationInfo?.hoursUntilExperience ?? 0) % 1) * 60);

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" aria-describedby="cancellation-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('cancelBookingTitle')}
          </DialogTitle>
          <DialogDescription id="cancellation-description">{t('policyExplanation')}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-slate-500">{tCommon('loading')}</div>
        ) : cancellationInfo && !cancellationInfo.canCancel ? (
          <div className="py-4">
            <p className="text-sm text-red-600">{cancellationInfo.reason}</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Refund eligibility status */}
            <div
              className={cn(
                'rounded-lg p-4',
                cancellationInfo?.isEligibleForRefund
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-amber-50 border border-amber-200'
              )}
            >
              <div className="flex items-start gap-3">
                {cancellationInfo?.isEligibleForRefund ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p
                    className={cn(
                      'font-medium',
                      cancellationInfo?.isEligibleForRefund
                        ? 'text-green-800'
                        : 'text-amber-800'
                    )}
                  >
                    {cancellationInfo?.isEligibleForRefund
                      ? t('refundEligible')
                      : t('noRefundEligible')}
                  </p>
                </div>
              </div>
            </div>

            {/* Time remaining for refund */}
            {cancellationInfo?.isEligibleForRefund && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="h-4 w-4" />
                <span>{t('timeRemaining')}:</span>
                <span className="font-medium">
                  {t('hoursRemaining', {
                    hours: Math.max(0, hours - 24),
                    minutes,
                  })}
                </span>
              </div>
            )}

            {/* Refund amount */}
            <div className="flex items-center justify-between py-3 border-t border-b border-stone-200">
              <span className="text-slate-600">{t('refundAmount')}</span>
              <span
                className={cn(
                  'text-lg font-bold',
                  cancellationInfo?.isEligibleForRefund
                    ? 'text-green-600'
                    : 'text-slate-400'
                )}
              >
                {cancellationInfo?.isEligibleForRefund
                  ? formatCHF(totalPrice)
                  : t('noRefundAmount')}
              </span>
            </div>

            {/* Confirmation checkbox */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="confirm-cancel"
                checked={isConfirmed}
                onCheckedChange={(checked) => setIsConfirmed(checked === true)}
              />
              <Label
                htmlFor="confirm-cancel"
                className="text-sm text-slate-600 cursor-pointer leading-tight"
              >
                {t('confirmCheckbox')}
              </Label>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isCancelling}>
            {t('title').split(' ')[0] === 'Conditions' ? 'Annuler' : 'Cancel'}
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={!isConfirmed || !cancellationInfo?.canCancel}
            isLoading={isCancelling}
            loadingText={t('cancelling')}
          >
            {t('confirmCancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
