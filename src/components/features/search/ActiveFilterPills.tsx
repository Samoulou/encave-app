'use client';

import { ExperienceType, Locale as ContentLocale } from '@prisma/client';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCHF } from '@/lib/utils/currency';
import { formatDateShort } from '@/lib/i18n/formatters';
import { localDateFromKey } from '@/lib/utils/date-key';
import { matchBudgetPreset } from '@/lib/constants/budget-presets';
import type { Locale } from '@/i18n/routing';

interface ActiveFilterPillsProps {
  search: string;
  types: ExperienceType[];
  commune: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  capacity: number | null;
  /** "YYYY-MM-DD" date filter, null = any date. */
  quand: string | null;
  /** Optional inclusive range end (weekend chip). */
  quandFin: string | null;
  language: ContentLocale | null;
  onRemoveSearch: () => void;
  onRemoveType: (_type: ExperienceType) => void;
  onRemoveCommune: () => void;
  onRemoveBudget: () => void;
  onRemoveDate: () => void;
  onRemoveCapacity: () => void;
  onRemoveLanguage: () => void;
  onClearAll: () => void;
  className?: string;
}

interface Pill {
  id: string;
  label: string;
  onRemove: () => void;
}

/**
 * Active-filter pills (L-115): one removable badge per active filter,
 * each × clears only its own filter. Rendered above the results in both
 * the desktop and mobile catalogue layouts.
 */
export function ActiveFilterPills({
  search,
  types,
  commune,
  minPrice,
  maxPrice,
  capacity,
  quand,
  quandFin,
  language,
  onRemoveSearch,
  onRemoveType,
  onRemoveCommune,
  onRemoveBudget,
  onRemoveDate,
  onRemoveCapacity,
  onRemoveLanguage,
  onClearAll,
  className,
}: ActiveFilterPillsProps) {
  const t = useTranslations('search');
  const tExp = useTranslations('experience.types');
  const locale = useLocale() as Locale;

  const pills: Pill[] = [];

  if (search) {
    pills.push({ id: 'search', label: search, onRemove: onRemoveSearch });
  }

  types.forEach((type) => {
    pills.push({
      id: `type-${type}`,
      label: tExp(type),
      onRemove: () => onRemoveType(type),
    });
  });

  if (commune !== null) {
    pills.push({ id: 'commune', label: commune, onRemove: onRemoveCommune });
  }

  if (minPrice !== null || maxPrice !== null) {
    const preset = matchBudgetPreset(minPrice, maxPrice);
    let budgetLabel: string;
    if (preset) {
      budgetLabel = t(`budget.${preset.key}`);
    } else if (minPrice !== null && maxPrice !== null) {
      budgetLabel = `${formatCHF(minPrice)} – ${formatCHF(maxPrice)}`;
    } else if (minPrice !== null) {
      budgetLabel = `${t('min')}: ${formatCHF(minPrice)}`;
    } else if (maxPrice !== null) {
      budgetLabel = `${t('max')}: ${formatCHF(maxPrice)}`;
    } else {
      budgetLabel = t('budget.label');
    }
    pills.push({ id: 'budget', label: budgetLabel, onRemove: onRemoveBudget });
  }

  if (quand !== null) {
    const dateLabel =
      quandFin !== null && quandFin !== quand
        ? t('dateRange', {
            from: formatDateShort(localDateFromKey(quand), locale),
            to: formatDateShort(localDateFromKey(quandFin), locale),
          })
        : formatDateShort(localDateFromKey(quand), locale);
    pills.push({ id: 'date', label: dateLabel, onRemove: onRemoveDate });
  }

  if (language !== null) {
    pills.push({
      id: 'language',
      label: t(`languages.${language}`),
      onRemove: onRemoveLanguage,
    });
  }

  if (capacity !== null) {
    pills.push({
      id: 'capacity',
      label: t('capacityPill', { count: capacity }),
      onRemove: onRemoveCapacity,
    });
  }

  if (pills.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      aria-label={t('activeFilters')}
    >
      {pills.map((pill) => (
        <span
          key={pill.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-burgundy-200 bg-burgundy-50 py-1 pl-3 pr-1.5 text-xs font-medium text-burgundy-800"
        >
          {pill.label}
          <button
            type="button"
            onClick={pill.onRemove}
            aria-label={t('removeFilter', { filter: pill.label })}
            className="flex h-4 w-4 items-center justify-center rounded-full text-burgundy-500 transition-colors hover:bg-burgundy-100 hover:text-burgundy-800"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-semibold text-burgundy-700 underline-offset-2 hover:underline"
      >
        {t('clearAll')}
      </button>
    </div>
  );
}
