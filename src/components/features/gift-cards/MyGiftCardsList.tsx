'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { formatCHF } from '@/lib/utils/currency';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { resendGiftCardAction } from '@/server/actions/giftCard';
import type { MyGiftCard } from '@/server/queries/giftCard.queries';

const STATUS_KEY = {
  ACTIVE: 'statusActiveLabel',
  DISABLED: 'statusDisabledLabel',
  EXPIRED: 'statusExpiredLabel',
} as const;

export function MyGiftCardsList({
  cards,
  locale,
}: {
  cards: MyGiftCard[];
  locale: Locale;
}) {
  const t = useTranslations('giftCards');
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  function onResend(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await resendGiftCardAction({ giftCardId: id });
      setFeedback((prev) => ({
        ...prev,
        [id]: result.success ? t('compteResent') : t('compteResendError'),
      }));
      setBusyId(null);
    });
  }

  if (cards.length === 0) {
    return <p className="text-muted-foreground">{t('compteEmpty')}</p>;
  }

  return (
    <ul className="space-y-4">
      {cards.map((card) => (
        <li
          key={card.id}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-xs">
                {card.role === 'purchased'
                  ? t('compteRolePurchased')
                  : t('compteRoleReceived')}
              </span>
              <p className="mt-2 font-mono text-lg tracking-widest">
                {card.code}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(STATUS_KEY[card.status])} · {t('validUntilLabel')}{' '}
                {formatDate(card.expiresAt, locale)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-serif text-2xl font-bold">
                {formatCHF(card.balance)}
              </p>
              <p className="text-xs text-muted-foreground">
                / {formatCHF(card.initialAmount)}
              </p>
            </div>
          </div>

          {card.status === 'ACTIVE' && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending && busyId === card.id}
                onClick={() => onResend(card.id)}
              >
                {isPending && busyId === card.id
                  ? t('compteResending')
                  : t('compteResend')}
              </Button>
              {feedback[card.id] && (
                <span className="text-sm text-muted-foreground">
                  {feedback[card.id]}
                </span>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
