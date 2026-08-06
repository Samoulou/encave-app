'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { fr, de, enUS } from 'date-fns/locale';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';

const localeMap = { fr, de, en: enUS };

interface CalendarNavigationProps {
  currentDate: Date;
  onDateChange: (_date: Date) => void;
  viewMode: 'calendar' | 'week';
}

export function CalendarNavigation({
  currentDate,
  onDateChange,
  viewMode,
}: CalendarNavigationProps) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const dateLocale = localeMap[locale as keyof typeof localeMap] || enUS;

  const handlePrevious = () => {
    if (viewMode === 'calendar') {
      onDateChange(subMonths(currentDate, 1));
    } else {
      onDateChange(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'calendar') {
      onDateChange(addMonths(currentDate, 1));
    } else {
      onDateChange(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const displayFormat =
    viewMode === 'calendar' ? 'MMMM yyyy' : "'Week of' MMM d, yyyy";

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleToday}>
        {t('today')}
      </Button>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevious}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNext}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        {format(currentDate, displayFormat, { locale: dateLocale })}
      </h2>
    </div>
  );
}
