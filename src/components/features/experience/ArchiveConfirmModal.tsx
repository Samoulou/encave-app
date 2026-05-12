'use client';

import { useTranslations } from 'next-intl';
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
  const t = useTranslations('experience.archiveModal');
  const tCommon = useTranslations('common.buttons');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('description', { title: experienceTitle })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {tCommon('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"
          >
            {isPending ? t('archiving') : t('archiveButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
