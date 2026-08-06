'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { formatCHF } from '@/lib/utils/currency';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { previewGiftRedemptionAction } from '@/server/actions/giftCard';

const ERROR_KEYS = new Set([
  'NOT_FOUND',
  'DISABLED',
  'EXPIRED',
  'DEPLETED',
  'WRONG_EXPERIENCE',
]);

/**
 * Checkout gift-code field (P-09 / L-084). Previews how much a code covers
 * (server-side, authoritative amount re-locked at submit) and lifts the
 * applied code + amount to the parent so it can display the net total and
 * pass them to createBookingAndCheckout.
 */
export function GiftCodeField({
  experienceId,
  guestCount,
  appliedCents,
  onApplied,
  onCleared,
}: {
  experienceId: string;
  guestCount: number;
  appliedCents: number;
  onApplied: (_code: string, _appliedCents: number) => void;
  onCleared: () => void;
}) {
  const t = useTranslations('checkout');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function apply() {
    setError(null);
    startTransition(async () => {
      const result = await previewGiftRedemptionAction({
        code,
        experienceId,
        guestCount,
      });
      if (result.success) {
        onApplied(code.trim(), result.data.applicableCents);
      } else {
        const reason = result.error.message.startsWith('GIFT_')
          ? result.error.message.slice(5)
          : '';
        setError(
          ERROR_KEYS.has(reason)
            ? t(`giftError${reason}`)
            : t('giftErrorGeneric')
        );
      }
    });
  }

  if (appliedCents > 0) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-accent px-4 py-3">
        <p className="text-sm">
          {t('giftAppliedNote', { amount: formatCHF(appliedCents) })}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setCode('');
            onCleared();
          }}
        >
          {t('giftRemove')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="giftCode">{t('giftCodeLabel')}</Label>
      <div className="flex gap-2">
        <Input
          id="giftCode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('giftCodePlaceholder')}
          autoComplete="off"
        />
        <Button
          type="button"
          variant="outline"
          disabled={isPending || code.trim().length < 4}
          onClick={apply}
        >
          {t('giftApply')}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
