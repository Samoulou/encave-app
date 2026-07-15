'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { AtSign } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChangeEmailSectionProps {
  currentEmail: string;
}

/**
 * Self-service email change (P-14 / L-151). better-auth sends a confirmation
 * to the CURRENT address only when it is verified; unverified accounts change
 * instantly (documented behaviour — surfaced in the success copy).
 */
export function ChangeEmailSection({ currentEmail }: ChangeEmailSectionProps) {
  const t = useTranslations('accountSecurity.email');
  const tCommon = useTranslations('common');
  const [newEmail, setNewEmail] = useState('');
  const [banner, setBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBanner(null);
    if (newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      setBanner({ type: 'error', message: t('sameEmail') });
      return;
    }
    startTransition(async () => {
      const result = await authClient.changeEmail({
        newEmail: newEmail.trim(),
        callbackURL: '/dashboard/settings',
      });
      if (result.error) {
        setBanner({
          type: 'error',
          message: result.error.message || tCommon('errors.somethingWentWrong'),
        });
        return;
      }
      setBanner({ type: 'success', message: t('success') });
      setNewEmail('');
    });
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
        <AtSign className="h-4 w-4" aria-hidden="true" />
        {t('title')}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('description', { email: currentEmail })}
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="ce-new"
            className="text-sm font-medium text-foreground"
          >
            {t('newEmail')}
          </label>
          <Input
            id="ce-new"
            type="email"
            autoComplete="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder={tCommon('placeholders.email')}
          />
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
