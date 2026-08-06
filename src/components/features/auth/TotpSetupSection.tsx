'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TotpSetupSectionProps {
  /** Called once TOTP is verified + enabled. */
  onEnabled?: () => void;
  /** Navigate here after enabling (e.g. the admin forced-setup flow). */
  redirectTo?: string;
}

/**
 * TOTP enrolment (P-14 / L-152). Password → enable (get otpauth URI + backup
 * codes) → scan QR → confirm a code. Mounted for admins (mandatory) on the
 * forced-setup page.
 */
export function TotpSetupSection({
  onEnabled,
  redirectTo,
}: TotpSetupSectionProps) {
  const t = useTranslations('accountSecurity.totp');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [step, setStep] = useState<'password' | 'confirm' | 'done'>('password');
  const [password, setPassword] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function enable() {
    setIsPending(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.enable({ password });
      if (result.error || !result.data) {
        setError(result.error?.message || t('enableFailed'));
        return;
      }
      setTotpUri(result.data.totpURI);
      setBackupCodes(result.data.backupCodes ?? []);
      setStep('confirm');
    } catch {
      setError(tCommon('errors.somethingWentWrong'));
    } finally {
      setIsPending(false);
    }
  }

  async function confirm() {
    setIsPending(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code });
      if (result.error) {
        setError(result.error.message || t('invalidCode'));
        return;
      }
      setStep('done');
      onEnabled?.();
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      setError(tCommon('errors.somethingWentWrong'));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        {t('title')}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {step === 'password' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enable();
          }}
          className="mt-4 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor="totp-password"
              className="text-sm font-medium text-foreground"
            >
              {t('confirmPassword')}
            </label>
            <Input
              id="totp-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="self-start"
            isLoading={isPending}
          >
            {t('start')}
          </Button>
        </form>
      )}

      {step === 'confirm' && (
        <div className="mt-4 flex flex-col gap-5">
          <div>
            <p className="mb-3 text-sm text-muted-foreground">{t('scan')}</p>
            <div className="inline-flex rounded-lg border border-stone-200 bg-white p-3">
              <QRCodeSVG value={totpUri} size={160} />
            </div>
          </div>

          {backupCodes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">
                {t('backupTitle')}
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                {t('backupDescription')}
              </p>
              <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((c) => (
                  <li
                    key={c}
                    className="rounded bg-stone-100 px-3 py-1.5 text-center"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirm();
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label
                htmlFor="totp-code"
                className="text-sm font-medium text-foreground"
              >
                {t('enterCode')}
              </label>
              <Input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="max-w-[200px] text-center text-lg tracking-[0.4em]"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="self-start"
              isLoading={isPending}
            >
              {t('verify')}
            </Button>
          </form>
        </div>
      )}

      {step === 'done' && (
        <p className="mt-4 text-sm font-medium text-green-700">
          {t('enabled')}
        </p>
      )}
    </section>
  );
}
