'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { approveWinery, rejectWinery } from '@/server/actions/admin';
import type { WineryStatus } from '@prisma/client';
import { useLocale, useTranslations } from 'next-intl';
import { WineryInfoPanel } from './WineryInfoPanel';
import { WineryVerificationPanel } from './WineryVerificationPanel';
import { WineryActionsPanel, WineryActionButtons } from './WineryActionsPanel';

interface WineryDetailViewProps {
  winery: {
    id: string;
    name: string;
    slug: string;
    description: string;
    address: string;
    commune: string;
    phone: string;
    email: string;
    coverPhoto: string | null;
    status: WineryStatus;
    verifiedAt: Date | null;
    rejectionReason: string | null;
    createdAt: Date;
    user: {
      name: string | null;
      email: string;
    };
    galleryImages: { id: string; url: string }[];
  };
}

export function WineryDetailView({ winery }: WineryDetailViewProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('admin');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const isPending = winery.status === 'PENDING';

  async function handleApprove() {
    setIsApproving(true);
    try {
      const result = await approveWinery(winery.id);
      if (result.success) {
        toast.success(t('wineryApprovedSuccess'));
        router.push('/admin/wineries/pending');
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    } finally {
      setIsApproving(false);
      setShowApproveDialog(false);
    }
  }

  async function handleReject() {
    if (!rejectionReason.trim()) {
      toast.error(t('pleaseProvideRejectionReason'));
      return;
    }

    setIsRejecting(true);
    try {
      const result = await rejectWinery(winery.id, rejectionReason);
      if (result.success) {
        toast.success(t('wineryRejectedSuccess'));
        router.push('/admin/wineries/pending');
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    } finally {
      setIsRejecting(false);
      setShowRejectDialog(false);
    }
  }

  return (
    <div className="space-y-6">
      <WineryVerificationPanel
        winery={winery}
        actions={
          <WineryActionButtons
            isPending={isPending}
            isApproving={isApproving}
            isRejecting={isRejecting}
            onApproveClick={() => setShowApproveDialog(true)}
            onRejectToggle={() => setShowRejectForm(!showRejectForm)}
          />
        }
      />

      <WineryActionsPanel
        wineryName={winery.name}
        isPending={isPending}
        isApproving={isApproving}
        isRejecting={isRejecting}
        showRejectForm={showRejectForm}
        rejectionReason={rejectionReason}
        showApproveDialog={showApproveDialog}
        showRejectDialog={showRejectDialog}
        onApprove={handleApprove}
        onReject={handleReject}
        onRejectionReasonChange={setRejectionReason}
        onRejectFormCancel={() => {
          setShowRejectForm(false);
          setRejectionReason('');
        }}
        onApproveDialogChange={setShowApproveDialog}
        onRejectDialogChange={setShowRejectDialog}
        onConfirmRejectionClick={() => setShowRejectDialog(true)}
      />

      <WineryInfoPanel winery={winery} locale={locale} />
    </div>
  );
}
