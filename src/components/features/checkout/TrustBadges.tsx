'use client';

import { useTranslations } from 'next-intl';

export function TrustBadges() {
  const t = useTranslations('checkout');

  return (
    <div className="mt-6 flex justify-center gap-4 opacity-50 grayscale hover:grayscale-0 transition-all duration-300">
      <div className="text-xs font-bold text-foreground border border-current px-2 py-1 rounded">
        {t('sslEncrypted')}
      </div>
      <div className="text-xs font-bold text-foreground border border-current px-2 py-1 rounded">
        {t('support247')}
      </div>
    </div>
  );
}
