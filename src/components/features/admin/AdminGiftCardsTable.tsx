'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { formatCHF } from '@/lib/utils/currency';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { disableGiftCardAction } from '@/server/actions/giftCard';
import type { AdminGiftCardRow } from '@/server/queries/giftCard.queries';

const STATUS_KEY = {
  ACTIVE: 'statusActiveLabel',
  DISABLED: 'statusDisabledLabel',
  EXPIRED: 'statusExpiredLabel',
} as const;

export function AdminGiftCardsTable({
  cards,
  locale,
}: {
  cards: AdminGiftCardRow[];
  locale: Locale;
}) {
  const t = useTranslations('giftCards');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function onDisable(id: string) {
    if (!window.confirm(t('adminConfirmDisable'))) return;
    setBusyId(id);
    startTransition(async () => {
      await disableGiftCardAction({ giftCardId: id });
      router.refresh();
      setBusyId(null);
    });
  }

  if (cards.length === 0) {
    return <p className="text-muted-foreground">{t('adminEmpty')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Accordion type="multiple" className="w-full">
        {cards.map((card) => (
          <AccordionItem key={card.id} value={card.id}>
            <div className="flex items-center gap-3 py-1">
              <AccordionTrigger className="flex-1">
                <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-1 text-left text-sm">
                  <span className="font-mono font-medium">{card.code}</span>
                  <span
                    className={
                      card.status === 'DISABLED'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }
                  >
                    {t(STATUS_KEY[card.status])}
                  </span>
                  <span className="font-semibold">
                    {formatCHF(card.balance)}
                  </span>
                  <span className="text-muted-foreground">
                    {t('adminInitial')} {formatCHF(card.initialAmount)}
                  </span>
                  <span className="text-muted-foreground">
                    {card.purchaserEmail}
                  </span>
                </div>
              </AccordionTrigger>
              {card.status !== 'DISABLED' && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isPending && busyId === card.id}
                  onClick={() => onDisable(card.id)}
                >
                  {t('adminDisable')}
                </Button>
              )}
            </div>
            <AccordionContent>
              <div className="space-y-2 px-2 py-2 text-sm">
                <p className="text-muted-foreground">
                  {t('adminRecipient')}: {card.recipientEmail ?? '—'} ·{' '}
                  {t('adminExpires')}: {formatDate(card.expiresAt, locale)}
                </p>
                <table className="w-full text-left">
                  <tbody>
                    {card.transactions.map((tx) => (
                      <tr key={tx.id} className="border-t border-border">
                        <td className="py-1 pr-4">{t(`tx${tx.type}`)}</td>
                        <td className="py-1 pr-4 font-mono">
                          {tx.amount > 0 ? '+' : ''}
                          {formatCHF(tx.amount)}
                        </td>
                        <td className="py-1 text-muted-foreground">
                          {formatDate(tx.createdAt, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
