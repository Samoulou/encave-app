'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requestAccountDeletion } from '@/server/actions/privacy';
import { signOut } from '@/lib/auth-client';
import { useNavigateWithTransition } from '@/hooks/useNavigateWithTransition';

interface DeleteAccountSectionProps {
  email: string;
}

/**
 * nLPD self-service account deletion (L-007). Double confirmation: the
 * user must open the dialog AND type their account email before the
 * anonymization is triggered. On success the session is terminated.
 */
export function DeleteAccountSection({ email }: DeleteAccountSectionProps) {
  const t = useTranslations('clientDashboard.profile.deleteAccount');
  const { navigate } = useNavigateWithTransition();
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const emailMatches =
    confirmation.trim().toLowerCase() === email.toLowerCase();

  function handleConfirm() {
    if (!emailMatches) return;
    setError(null);
    startTransition(async () => {
      const result = await requestAccountDeletion({
        email: confirmation.trim(),
      });
      if (!result.success) {
        setError(
          result.error.message.startsWith('FUTURE_WINERY_BOOKINGS')
            ? t('errorFutureBookings')
            : t('errorGeneric')
        );
        return;
      }
      await signOut();
      navigate('/');
    });
  }

  return (
    <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-destructive">
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {t('title')}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="mt-4">
            {t('cta')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label
              htmlFor="delete-account-email"
              className="text-sm font-medium text-foreground"
            >
              {t('confirmLabel', { email })}
            </label>
            <Input
              id="delete-account-email"
              type="email"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={email}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirm();
              }}
              disabled={!emailMatches || isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? t('deleting') : t('confirmCta')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
