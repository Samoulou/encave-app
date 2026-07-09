'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { CalendarCheck, Check, Sparkles } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import {
  oneTapAccountSchema,
  type OneTapAccountInput,
} from '@/lib/validators/auth';
import { signIn, signUp } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OneTapAccountCardProps {
  /** Booking email — becomes the account email, shown but not editable. */
  visitorEmail: string;
  /** Booking visitor name — becomes the account name. */
  visitorName: string;
}

/**
 * Post-payment one-tap account creation (P-04 / L-053, decision D6):
 * email and name are pre-filled from the booking, the guest only picks a
 * password. Bookings attach automatically — the client-booking queries
 * already match `visitorEmail` case-insensitively, no linking needed.
 */
export function OneTapAccountCard({
  visitorEmail,
  visitorName,
}: OneTapAccountCardProps) {
  const t = useTranslations('confirmation');
  const tRegister = useTranslations('auth.register');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreated, setIsCreated] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OneTapAccountInput>({
    resolver: zodResolver(oneTapAccountSchema),
    defaultValues: { password: '' },
  });

  async function onSubmit(data: OneTapAccountInput) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signUp.email({
        email: visitorEmail,
        password: data.password,
        name: visitorName,
      });

      if (result.error) {
        if (result.error.code === 'USER_ALREADY_EXISTS') {
          setError(tRegister('emailExists'));
        } else {
          setError(
            result.error.message || tCommon('errors.somethingWentWrong')
          );
        }
        return;
      }

      // Auto-login, same flow as RegisterForm.
      const loginResult = await signIn.email({
        email: visitorEmail,
        password: data.password,
      });

      if (loginResult.error) {
        // Account created but login failed — hand over to the login page.
        router.push('/login');
        return;
      }

      setIsCreated(true);
      router.refresh();
    } catch {
      setError(tCommon('errors.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  if (isCreated) {
    return (
      <Card
        className="border-vine/30 bg-white hover:translate-y-0 hover:shadow-card"
        data-testid="one-tap-account-success"
      >
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-green-50 text-vine">
            <Check className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="font-display text-xl font-semibold text-ink-900">
            {t('oneTap.successTitle')}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {t('oneTap.successDescription')}
          </p>
          <Button asChild className="mt-2">
            <Link href="/dashboard/my-bookings">
              <CalendarCheck className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('viewMyBookings')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="hover:translate-y-0 hover:shadow-card"
      data-testid="one-tap-account-card"
    >
      <CardContent className="p-6 sm:p-8">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-burgundy-50 text-burgundy-700">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-900">
              {t('oneTap.title')}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t('oneTap.description')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="one-tap-email">{tCommon('labels.email')}</Label>
            <Input
              id="one-tap-email"
              type="email"
              value={visitorEmail}
              readOnly
              disabled
              autoComplete="email"
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="one-tap-password">
              {tCommon('labels.password')}
            </Label>
            <Input
              id="one-tap-password"
              type="password"
              placeholder={tRegister('passwordPlaceholder')}
              autoComplete="new-password"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby="one-tap-password-hint one-tap-password-error"
              {...register('password')}
            />
            <p
              id="one-tap-password-hint"
              className="text-xs text-muted-foreground"
            >
              {tRegister('passwordHint')}
            </p>
            {errors.password?.message && (
              <p
                id="one-tap-password-error"
                className="text-sm font-medium text-red-700"
              >
                {tErrors(errors.password.message)}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="mt-5 w-full"
            isLoading={isLoading}
            loadingText={tRegister('creatingAccount')}
          >
            {t('oneTap.createCta')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
