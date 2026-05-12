import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { CheckCircle, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface WineryActionsPanelProps {
  wineryName: string;
  isPending: boolean;
  isApproving: boolean;
  isRejecting: boolean;
  showRejectForm: boolean;
  rejectionReason: string;
  showApproveDialog: boolean;
  showRejectDialog: boolean;
  onApproveClick: () => void;
  onRejectToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRejectionReasonChange: (_value: string) => void;
  onRejectFormCancel: () => void;
  onApproveDialogChange: (_open: boolean) => void;
  onRejectDialogChange: (_open: boolean) => void;
  onConfirmRejectionClick: () => void;
}

/**
 * Renders the approve/reject action buttons.
 * Designed to be placed inside the header card's flex layout via the
 * WineryVerificationPanel's `actions` prop.
 */
export function WineryActionButtons({
  isPending,
  isApproving,
  isRejecting,
  onApproveClick,
  onRejectToggle,
}: Pick<
  WineryActionsPanelProps,
  | 'isPending'
  | 'isApproving'
  | 'isRejecting'
  | 'onApproveClick'
  | 'onRejectToggle'
>) {
  const t = useTranslations('admin');

  if (!isPending) return null;

  return (
    <div className="flex gap-3">
      <Button
        onClick={onApproveClick}
        disabled={isApproving || isRejecting}
        className="bg-emerald-600 shadow-md hover:bg-emerald-700"
        size="lg"
      >
        <CheckCircle className="mr-2 h-5 w-5" />
        {t('approve')}
      </Button>
      <Button
        variant="destructive"
        onClick={onRejectToggle}
        disabled={isApproving || isRejecting}
        size="lg"
        className="shadow-md"
      >
        <XCircle className="mr-2 h-5 w-5" />
        {t('reject')}
      </Button>
    </div>
  );
}

/**
 * Renders the confirmation dialogs and the rejection reason form.
 * These are rendered as siblings in the main layout flow.
 */
export function WineryActionsPanel({
  wineryName,
  isPending,
  isApproving,
  isRejecting,
  showRejectForm,
  rejectionReason,
  showApproveDialog,
  showRejectDialog,
  onApprove,
  onReject,
  onRejectionReasonChange,
  onRejectFormCancel,
  onApproveDialogChange,
  onRejectDialogChange,
  onConfirmRejectionClick,
}: Omit<WineryActionsPanelProps, 'onApproveClick' | 'onRejectToggle'>) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  return (
    <>
      {/* Approval Confirmation Dialog */}
      <AlertDialog
        open={showApproveDialog}
        onOpenChange={onApproveDialogChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('approveWinery')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('approveConfirmation', { name: wineryName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onApprove}
              disabled={isApproving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isApproving ? t('approving') : t('yesApprove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rejection Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={onRejectDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rejectWinery')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('rejectConfirmation', { name: wineryName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onReject}
              disabled={isRejecting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRejecting ? t('rejecting') : t('yesReject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rejection Form */}
      {showRejectForm && isPending && (
        <Card className="border-2 border-red-200 bg-red-50/50 shadow-warm">
          <CardHeader className="border-b border-red-100">
            <CardTitle className="flex items-center gap-2 text-lg text-red-700">
              <XCircle className="h-5 w-5" />
              {t('rejectionReason')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <Label htmlFor="rejectionReason" className="text-red-700">
                {t('rejectionReasonRequired')}
              </Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => onRejectionReasonChange(e.target.value)}
                placeholder={t('rejectionReasonPlaceholder')}
                className="mt-2 border-red-200 focus:border-red-400 focus:ring-red-400/20"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={onConfirmRejectionClick}
                disabled={isRejecting || !rejectionReason.trim()}
              >
                {t('confirmRejection')}
              </Button>
              <Button variant="outline" onClick={onRejectFormCancel}>
                {tCommon('buttons.cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
