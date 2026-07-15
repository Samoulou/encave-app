'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { signUp } from '@/lib/auth-client';
import { provisionFounderWinery } from '@/server/actions/invitation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface InvitationAcceptFormProps {
  token: string;
  email: string;
  wineryName: string;
}

const MIN_PASSWORD_LENGTH = 8;

/**
 * Founder-invitation acceptance (P-14 / L-154). Two calls: sign up (sets the
 * session + credential account) then provision the VERIFIED FOUNDER winery.
 */
export function InvitationAcceptForm({
  token,
  email,
  wineryName: initialWineryName,
}: InvitationAcceptFormProps) {
  const t = useTranslations('invitation');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [name, setName] = useState('');
  const [wineryName, setWineryName] = useState(initialWineryName);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    setIsLoading(true);
    try {
      const signUpResult = await signUp.email({ email, password, name });
      if (signUpResult.error) {
        setError(
          signUpResult.error.message || tCommon('errors.somethingWentWrong')
        );
        return;
      }
      const provision = await provisionFounderWinery({
        token,
        wineryName: wineryName.trim(),
      });
      if (!provision.success) {
        setError(provision.error.message);
        return;
      }
      router.push('/dashboard/winery/profile');
      router.refresh();
    } catch {
      setError(tCommon('errors.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label
          htmlFor="inv-email"
          className="text-sm font-medium text-foreground"
        >
          {tCommon('labels.email')}
        </label>
        <Input id="inv-email" type="email" value={email} disabled readOnly />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="inv-name"
          className="text-sm font-medium text-foreground"
        >
          {t('nameLabel')}
        </label>
        <Input
          id="inv-name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="inv-winery"
          className="text-sm font-medium text-foreground"
        >
          {t('wineryNameLabel')}
        </label>
        <Input
          id="inv-winery"
          required
          value={wineryName}
          onChange={(e) => setWineryName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="inv-password"
          className="text-sm font-medium text-foreground"
        >
          {tCommon('labels.password')}
        </label>
        <Input
          id="inv-password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        className="mt-2 h-12 w-full rounded-lg"
        isLoading={isLoading}
        loadingText={t('creating')}
      >
        {t('cta')}
      </Button>
    </form>
  );
}
