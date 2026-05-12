'use client';

import { useTranslations } from 'next-intl';

export function TrustBadges() {
  const t = useTranslations('checkout');

  return (
    <div className="mt-6 flex justify-center gap-4 opacity-50 grayscale transition-all duration-300 hover:grayscale-0">
      <div className="rounded border border-current px-2 py-1 text-xs font-bold text-foreground">
        {t('sslEncrypted')}
      </div>
      <div className="rounded border border-current px-2 py-1 text-xs font-bold text-foreground">
        {t('support247')}
      </div>
    </div>
  );
}
