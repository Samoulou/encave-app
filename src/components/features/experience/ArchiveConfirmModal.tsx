'use client';

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

interface ArchiveConfirmModalProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  experienceTitle: string;
  onConfirm: () => void;
  isPending: boolean;
}

export function ArchiveConfirmModal({
  open,
  onOpenChange,
  experienceTitle,
  onConfirm,
  isPending,
}: ArchiveConfirmModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive Experience</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to archive &quot;{experienceTitle}&quot;? This
            experience will no longer be visible to visitors. You can restore it
            later if needed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"
          >
            {isPending ? 'Archiving...' : 'Archive'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
