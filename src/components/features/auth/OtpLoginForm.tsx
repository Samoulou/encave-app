'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Mail } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { authClient, signIn } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveLoginRedirect } from './login-redirect';

interface OtpLoginFormProps {
  /** Switch back to the password form. */
  onUsePassword: () => void;
}

/**
 * Passwordless login via a 6-digit email OTP (P-14 / L-150). Two steps:
 * request a code, then verify it. A 2FA-enabled account (admin) is routed to
 * /login/2fa afterwards.
 */
export function OtpLoginForm({ onUsePassword }: OtpLoginFormProps) {
  const t = useTranslations('auth.otpLogin');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function sendCode() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
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

  async function verifyCode() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signIn.emailOtp({ email, otp });
      if (result.error) {
        setError(result.error.message || t('invalidCode'));
        return;
      }
      // A 2FA-enabled account must clear the second factor first.
      if (
        (result.data as { twoFactorRedirect?: boolean } | undefined)
          ?.twoFactorRedirect
      ) {
        router.push('/login/2fa');
        return;
      }
      const role = (result.data?.user as { role?: string } | undefined)?.role;
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
    <div className="flex flex-col gap-5">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {step === 'email' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor="otp-email"
              className="text-sm font-medium text-foreground"
            >
              {tCommon('labels.email')}
            </label>
            <div className="group relative">
              <Input
                id="otp-email"
                type="email"
                required
                autoComplete="email"
                placeholder={tCommon('placeholders.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-lg border border-border bg-white px-4 pr-10"
              />
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </div>
          <Button
            type="submit"
            className="h-12 w-full rounded-lg"
            isLoading={isLoading}
            loadingText={t('sending')}
          >
            {t('sendCode')}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verifyCode();
          }}
          className="flex flex-col gap-5"
        >
          <p className="text-sm text-muted-foreground">
            {t('codeSentTo', { email })}
          </p>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="otp-code"
              className="text-sm font-medium text-foreground"
            >
              {t('codeLabel')}
            </label>
            <Input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="h-12 w-full rounded-lg border border-border bg-white px-4 text-center text-lg tracking-[0.4em]"
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
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={isLoading}
            className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
          >
            {t('resend')}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onUsePassword}
        className="mt-2 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('usePassword')}
      </button>
    </div>
  );
}
