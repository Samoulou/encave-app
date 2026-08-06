'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TotpSetupSection } from './TotpSetupSection';

interface AdminSecuritySetupProps {
  /** Whether the admin already has a password (credential account). */
  hasPassword: boolean;
  email: string;
}

const MIN_PASSWORD_LENGTH = 8;

/**
 * Admin forced-security setup (P-14 / L-152). TOTP enrolment requires a
 * password (better-auth), which an OAuth-only (Google) admin doesn't have —
 * that would lock them out. So a credential-less admin first sets a password
 * via an email OTP, then enrols TOTP. /forgot-password is unreachable while
 * logged in, hence this inline step.
 */
export function AdminSecuritySetup({
  hasPassword,
  email,
}: AdminSecuritySetupProps) {
  const t = useTranslations('accountSecurity.setPassword');
  const tCommon = useTranslations('common');
  const [passwordSet, setPasswordSet] = useState(hasPassword);
  const [step, setStep] = useState<'send' | 'code'>('send');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (passwordSet) {
    return <TotpSetupSection redirectTo="/admin" />;
  }

  async function sendCode() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'forget-password',
      });
      if (result.error) {
        setError(result.error.message || tCommon('errors.somethingWentWrong'));
        return;
      }
      setStep('code');
    } catch {
      setError(tCommon('errors.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  async function submit() {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('tooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    setIsLoading(true);
    try {
      // emailOtp.resetPassword ADDS a password for an OAuth-only account.
      const result = await authClient.emailOtp.resetPassword({
        email,
        otp,
        password,
      });
      if (result.error) {
        setError(result.error.message || t('failed'));
        return;
      }
      setPasswordSet(true);
    } catch {
      setError(tCommon('errors.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="text-base font-bold text-foreground">{t('title')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {step === 'send' ? (
        <Button
          type="button"
          className="mt-4"
          size="sm"
          isLoading={isLoading}
          onClick={() => void sendCode()}
        >
          {t('sendCode')}
        </Button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="mt-4 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="sp-code" className="text-sm font-medium">
              {t('codeLabel')}
            </label>
            <Input
              id="sp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="max-w-[200px] text-center text-lg tracking-[0.4em]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="sp-password" className="text-sm font-medium">
              {t('newPassword')}
            </label>
            <Input
              id="sp-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="self-start"
            isLoading={isLoading}
          >
            {t('submit')}
          </Button>
        </form>
      )}
    </section>
  );
}
