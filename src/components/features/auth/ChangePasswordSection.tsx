'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { KeyRound } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Self-service password change (P-14 / L-151). Revokes other sessions on
 * success. Rendered only for accounts that have a password (credential
 * account) — OAuth-only users have none.
 */
export function ChangePasswordSection() {
  const t = useTranslations('accountSecurity.password');
  const tCommon = useTranslations('common');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [banner, setBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBanner(null);
    if (next.length < MIN_PASSWORD_LENGTH) {
      setBanner({
        type: 'error',
        message: t('tooShort', { min: MIN_PASSWORD_LENGTH }),
      });
      return;
    }
    if (next !== confirm) {
      setBanner({ type: 'error', message: t('mismatch') });
      return;
    }
    startTransition(async () => {
      const result = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setBanner({
          type: 'error',
          message: result.error.message || tCommon('errors.somethingWentWrong'),
        });
        return;
      }
      setBanner({ type: 'success', message: t('success') });
      setCurrent('');
      setNext('');
      setConfirm('');
    });
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        {t('title')}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="cp-current"
            className="text-sm font-medium text-foreground"
          >
            {t('current')}
          </label>
          <Input
            id="cp-current"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="cp-next"
              className="text-sm font-medium text-foreground"
            >
              {t('new')}
            </label>
            <Input
              id="cp-next"
              type="password"
              autoComplete="new-password"
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="cp-confirm"
              className="text-sm font-medium text-foreground"
            >
              {t('confirm')}
            </label>
            <Input
              id="cp-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>
        {banner && (
          <p
            role="alert"
            className={
              banner.type === 'success'
                ? 'text-sm text-green-700'
                : 'text-sm text-destructive'
            }
          >
            {banner.message}
          </p>
        )}
        <Button
          type="submit"
          size="sm"
          className="self-start"
          isLoading={isPending}
        >
          {t('cta')}
        </Button>
      </form>
    </section>
  );
}
