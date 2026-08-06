'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/routing';
import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const localeLabels: Record<Locale, string> = {
  fr: 'FR',
  de: 'DE',
  en: 'EN',
};

export function LocaleSwitcher({
  triggerClassName,
}: { triggerClassName?: string } = {}) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('locale');

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div role="group" aria-label={t('languageSwitcher')}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-1.5 text-muted-foreground', triggerClassName)}
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span>{localeLabels[locale]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
