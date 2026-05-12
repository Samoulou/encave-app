'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { updateClientProfile } from '@/server/actions/client.actions';
import type { Locale } from '@prisma/client';

interface ClientProfileFormProps {
  initialName: string;
  email: string;
  initialLocale: Locale;
}

const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: 'FR', label: 'Francais' },
  { value: 'DE', label: 'Deutsch' },
  { value: 'EN', label: 'English' },
];

export function ClientProfileForm({
  initialName,
  email,
  initialLocale,
}: ClientProfileFormProps) {
  const t = useTranslations('clientDashboard.profile');
  const [name, setName] = useState(initialName);
  const [preferredLocale, setPreferredLocale] = useState<Locale>(initialLocale);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);

  const hasChanges = name !== initialName || preferredLocale !== initialLocale;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    startTransition(async () => {
      const res = await updateClientProfile({ name, preferredLocale });
      if (res.success) {
        setResult({ success: true });
      } else {
        setResult({ success: false, message: res.error.message });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-6 rounded-xl border border-border bg-white p-6 shadow-sm sm:p-8">
        {/* Name */}
        <div className="space-y-2">
          <label
            htmlFor="name"
            className="block text-sm font-bold text-foreground"
          >
            {t('name')}
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 w-full rounded-lg border border-border bg-white px-4 text-sm text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
            required
            minLength={1}
            maxLength={100}
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-bold text-foreground"
          >
            {t('email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            disabled
            className="h-11 w-full cursor-not-allowed rounded-lg border border-border bg-gray-50 px-4 text-sm text-gray-500"
          />
          <p className="text-xs text-[#915564]">{t('emailReadonly')}</p>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <label
            htmlFor="language"
            className="block text-sm font-bold text-foreground"
          >
            {t('language')}
          </label>
          <select
            id="language"
            value={preferredLocale}
            onChange={(e) => setPreferredLocale(e.target.value as Locale)}
            className="h-11 w-full rounded-lg border border-border bg-white px-4 text-sm text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {LOCALE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Result message */}
      {result && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-3 text-sm',
            result.success
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          )}
        >
          {result.success && <Check className="h-4 w-4" aria-hidden="true" />}
          {result.success ? t('saved') : result.message}
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        className="h-11 bg-primary px-8 font-bold text-white hover:bg-primary/90"
        disabled={isPending || !hasChanges}
      >
        {isPending ? t('saving') : t('save')}
      </Button>
    </form>
  );
}
