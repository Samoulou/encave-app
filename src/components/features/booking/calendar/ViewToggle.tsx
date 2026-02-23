'use client';

import { useQueryState } from 'nuqs';
import { List, CalendarDays } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export type ViewMode = 'list' | 'calendar' | 'week';

/**
 * Toggle between list and calendar views.
 * Matches the mockup design from US-UI-09.
 */
export function ViewToggle() {
  const t = useTranslations('bookings.views');
  const [view, setView] = useQueryState('view', { shallow: false });
  const currentView = (view as ViewMode) || 'list';

  return (
    <div className="bg-[#f8f6f6] p-1 rounded-lg flex items-center">
      <button
        className={cn(
          'px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2',
          currentView === 'list'
            ? 'bg-white text-foreground shadow-sm font-bold'
            : 'text-[#915564] hover:text-foreground'
        )}
        onClick={() => setView(null)}
      >
        <List className="h-4 w-4" />
        {t('listView')}
      </button>
      <button
        className={cn(
          'px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2',
          currentView === 'calendar'
            ? 'bg-white text-foreground shadow-sm font-bold'
            : 'text-[#915564] hover:text-foreground'
        )}
        onClick={() => setView('calendar')}
      >
        <CalendarDays className="h-4 w-4" />
        {t('calendarView')}
      </button>
    </div>
  );
}
