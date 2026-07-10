'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, UtensilsCrossed, Wine } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { upcomingWeekendRange, type WeekendRange } from '@/lib/utils/date-key';
import { cn } from '@/lib/utils';

interface HomeSearchShortcutsProps {
  /** Chip styling: on the dark hero photo or on the light page body. */
  tone?: 'onDark' | 'onLight';
  className?: string;
}

const CHIP_BASE =
  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors';

const CHIP_TONE = {
  onDark:
    'border-white/25 bg-white/15 text-white backdrop-blur-md hover:border-white/45 hover:bg-white/25',
  onLight:
    'border-stone-200 bg-white text-burgundy-700 hover:border-burgundy-200 hover:bg-cream-100',
} as const;

/**
 * Hero shortcut chips (P-05 / L-111): weekend date range + pre-filtered
 * types, straight to the catalogue. The weekend range is computed after
 * mount — the home page may be statically rendered, and a build-time
 * "next Saturday" would go stale.
 */
export function HomeSearchShortcuts({
  tone = 'onDark',
  className,
}: HomeSearchShortcutsProps) {
  const t = useTranslations('search.shortcuts');
  const [weekend, setWeekend] = useState<WeekendRange | null>(null);

  useEffect(() => {
    setWeekend(upcomingWeekendRange(new Date()));
  }, []);

  const weekendHref = weekend
    ? `/experiences?quand=${weekend.from}&quand_fin=${weekend.to}`
    : '/experiences';
  const chipClass = cn(CHIP_BASE, CHIP_TONE[tone]);

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Link href={weekendHref} className={chipClass}>
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
        {t('thisWeekend')}
      </Link>
      <Link href="/experiences?type=TASTING" className={chipClass}>
        <Wine className="h-3.5 w-3.5" aria-hidden="true" />
        {t('tastings')}
      </Link>
      <Link href="/experiences?type=MEAL" className={chipClass}>
        <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden="true" />
        {t('withMeal')}
      </Link>
    </div>
  );
}
