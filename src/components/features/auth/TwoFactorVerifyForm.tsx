'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthPageLayout } from './AuthPageLayout';
import { resolveLoginRedirect } from './login-redirect';
import loginImage from '@/../public/images/login-image.jpg';

/**
 * Second-factor verification at login (P-14 / L-152). Reached when a password
 * or OTP sign-in returns `twoFactorRedirect` (admins). Accepts a TOTP code or,
 * as a fallback, a one-time backup code.
 */
export function TwoFactorVerifyForm() {
  const t = useTranslations('auth.twoFactor');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'totp' | 'backup'>('totp');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const result =
        mode === 'totp'
          ? await authClient.twoFactor.verifyTotp({ code })
          : await authClient.twoFactor.verifyBackupCode({ code });
      if (result.error) {
        setError(result.error.message || t('invalid'));
        return;
      }
      const session = await authClient.getSession();
      const role = (session.data?.user as { role?: string } | undefined)?.role;
      router.push(
        resolveLoginRedirect(role, searchParams ?? new URLSearchParams())
      );
      router.refresh();
    } catch {
      setError(tCommon('errors.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthPageLayout
      imageUrl={loginImage}
      imageAlt={t('imageAlt')}
      heroTitle={t('heroTitle')}
      heroSubtitle={t('heroSubtitle')}
    >
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold text-foreground">
          {t('title')}
        </h1>
        <p className="text-muted-foreground">
          {mode === 'totp' ? t('subtitle') : t('backupSubtitle')}
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={verify} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="tf-code"
            className="text-sm font-medium text-foreground"
          >
            {mode === 'totp' ? t('codeLabel') : t('backupLabel')}
          </label>
          <Input
            id="tf-code"
            inputMode={mode === 'totp' ? 'numeric' : 'text'}
            autoComplete="one-time-code"
            required
            placeholder={mode === 'totp' ? '000000' : 'XXXXXXXX'}
            value={code}
            onChange={(e) =>
              setCode(
                mode === 'totp'
                  ? e.target.value.replace(/\D/g, '')
                  : e.target.value
              )
            }
            className="h-12 w-full rounded-lg border border-border bg-white px-4 text-center text-lg tracking-[0.3em]"
          />
        </div>
        <Button
          type="submit"
          className="h-12 w-full rounded-lg"
          isLoading={isLoading}
          loadingText={t('verifying')}
        >
          {t('verify')}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setError(null);
          setCode('');
          setMode(mode === 'totp' ? 'backup' : 'totp');
        }}
        className="mt-2 text-sm font-medium text-primary hover:underline"
      >
        {mode === 'totp' ? t('useBackup') : t('useTotp')}
      </button>
    </AuthPageLayout>
  );
}
