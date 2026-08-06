'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/routing';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const localeLabels: Record<Locale, string> = {
  fr: 'FR',
  de: 'DE',
  en: 'EN',
};

export function LocaleCurrencyChip() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('locale');

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500 transition-colors hover:bg-cream-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
        {localeLabels[locale]} · CHF
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t('languageSwitcher')}
        </DropdownMenuLabel>
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            className="flex items-center justify-between gap-4"
          >
            <span lang={loc}>{t(loc)}</span>
            {locale === loc && (
              <Check className="h-4 w-4 text-primary" aria-hidden="true" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="justify-between">
          <span>CHF</span>
          <Check className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
