'use client';

import { useTranslations } from 'next-intl';

export function TrustBadges() {
  const t = useTranslations('checkout');

  return (
    /* opacity-70 (was 50): 12px bold at 50% black-on-white sits under the
       4.5:1 WCAG AA ratio (axe color-contrast, P-16 / L-183). */
    <div className="mt-6 flex justify-center gap-4 opacity-70 grayscale transition-all duration-300 hover:grayscale-0">
      <div className="rounded border border-current px-2 py-1 text-xs font-bold text-foreground">
        {t('sslEncrypted')}
      </div>
      <div className="rounded border border-current px-2 py-1 text-xs font-bold text-foreground">
        {t('support247')}
      </div>
    </div>
  );
}
