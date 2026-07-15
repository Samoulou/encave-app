'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthPageLayout } from './AuthPageLayout';
import loginImage from '@/../public/images/login-image.jpg';

const MIN_PASSWORD_LENGTH = 8;

/**
 * OTP-based password reset (P-14 / L-150) — replaces the old mailto stopgap.
 * Steps: request a code → enter code + new password → done.
 */
export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      setStep('reset');
    } catch {
      setError(tCommon('errors.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  async function reset() {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t('passwordMismatch'));
      return;
    }
    setIsLoading(true);
    try {
      const result = await authClient.emailOtp.resetPassword({
        email,
        otp,
        password,
      });
      if (result.error) {
        setError(result.error.message || t('resetFailed'));
        return;
      }
      setStep('done');
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
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {step === 'done' ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <CheckCircle2
            className="h-12 w-12 text-green-600"
            aria-hidden="true"
          />
          <p className="text-foreground">{t('successMessage')}</p>
          <Button
            type="button"
            className="h-12 w-full rounded-lg"
            onClick={() => router.push('/login')}
          >
            {t('backToLogin')}
          </Button>
        </div>
      ) : step === 'email' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor="fp-email"
              className="text-sm font-medium text-foreground"
            >
              {tCommon('labels.email')}
            </label>
            <Input
              id="fp-email"
              type="email"
              required
              autoComplete="email"
              placeholder={tCommon('placeholders.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-lg border border-border bg-white px-4"
            />
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
            void reset();
          }}
          className="flex flex-col gap-5"
        >
          <p className="text-sm text-muted-foreground">
            {t('codeSentTo', { email })}
          </p>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="fp-code"
              className="text-sm font-medium text-foreground"
            >
              {t('codeLabel')}
            </label>
            <Input
              id="fp-code"
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
          <div className="flex flex-col gap-2">
            <label
              htmlFor="fp-password"
              className="text-sm font-medium text-foreground"
            >
              {t('newPassword')}
            </label>
            <Input
              id="fp-password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-lg border border-border bg-white px-4"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="fp-confirm"
              className="text-sm font-medium text-foreground"
            >
              {t('confirmPassword')}
            </label>
            <Input
              id="fp-confirm"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-12 w-full rounded-lg border border-border bg-white px-4"
            />
          </div>
          <Button
            type="submit"
            className="h-12 w-full rounded-lg"
            isLoading={isLoading}
            loadingText={t('resetting')}
          >
            {t('resetPassword')}
          </Button>
        </form>
      )}

      <div className="mt-4 text-center">
        <Link
          href="/login"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('backToLogin')}
        </Link>
      </div>
    </AuthPageLayout>
  );
}
