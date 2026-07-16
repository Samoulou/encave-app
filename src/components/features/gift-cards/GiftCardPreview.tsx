'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { GiftCardVariant } from '@/lib/constants/gift-card';

// Each variant carries a SOLID background color under its gradient: axe
// cannot read background-image gradients and falls through to the page
// background, flagging the light text (color-contrast, P-16 / L-183).
const VARIANT_CLASSES: Record<GiftCardVariant, string> = {
  NOEL: 'bg-red-950 from-red-950 to-red-800 text-red-50',
  ANNIVERSAIRE:
    'bg-primary from-primary to-[hsl(var(--primary-hover))] text-primary-foreground',
  NEUTRE: 'bg-neutral-900 from-neutral-900 to-neutral-700 text-neutral-50',
};

export function GiftCardPreview({
  variant,
  amount,
  experienceTitle,
  purchaserName,
  message,
}: {
  variant: GiftCardVariant;
  amount: string;
  experienceTitle?: string;
  purchaserName?: string;
  message?: string;
}) {
  const t = useTranslations('giftCards');

  return (
    <div
      className={cn(
        'flex aspect-[7/4] flex-col justify-between rounded-2xl bg-gradient-to-br p-6 shadow-xl',
        VARIANT_CLASSES[variant]
      )}
    >
      <div>
        <p className="text-xs uppercase tracking-widest opacity-80">
          {t('previewEyebrow')}
        </p>
        <p className="mt-1 font-serif text-xl font-semibold">EnCave</p>
      </div>

      <div>
        {experienceTitle ? (
          <p className="mb-1 text-sm font-medium opacity-90">
            {experienceTitle}
          </p>
        ) : null}
        <p className="font-serif text-4xl font-bold">{amount}</p>
        {message ? (
          <p className="mt-2 line-clamp-2 text-sm italic opacity-90">
            « {message} »
          </p>
        ) : null}
      </div>

      <div className="flex items-end justify-between text-xs opacity-80">
        <span>
          {purchaserName ? `${t('previewFrom')} ${purchaserName}` : ' '}
        </span>
        <span>{t('previewValidity')}</span>
      </div>
    </div>
  );
}
