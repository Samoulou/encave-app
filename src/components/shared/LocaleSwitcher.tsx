'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const localeLabels: Record<Locale, string> = {
  fr: 'FR',
  de: 'DE',
  en: 'EN',
};

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="flex items-center gap-1" role="navigation" aria-label="Language switcher">
      {locales.map((loc, index) => (
        <span key={loc} className="flex items-center">
          <button
            onClick={() => switchLocale(loc)}
            className={cn(
              'px-2 py-1 text-sm font-medium transition-colors rounded',
              locale === loc
                ? 'text-burgundy-700 bg-burgundy-50'
                : 'text-slate-600 hover:text-burgundy-600 hover:bg-burgundy-50/50'
            )}
            aria-current={locale === loc ? 'true' : undefined}
            aria-label={`Switch to ${loc === 'fr' ? 'French' : loc === 'de' ? 'German' : 'English'}`}
          >
            {localeLabels[loc]}
          </button>
          {index < locales.length - 1 && (
            <span className="text-slate-300 mx-0.5" aria-hidden="true">|</span>
          )}
        </span>
      ))}
    </div>
  );
}
