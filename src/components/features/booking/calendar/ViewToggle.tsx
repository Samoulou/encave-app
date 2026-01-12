'use client';

import { useQueryState } from 'nuqs';
import { List, CalendarDays, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ViewMode = 'list' | 'calendar' | 'week';

export function ViewToggle() {
  const [view, setView] = useQueryState('view', { shallow: false });
  const currentView = (view as ViewMode) || 'list';

  return (
    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 px-3',
          currentView === 'list' && 'bg-slate-100'
        )}
        onClick={() => setView(null)}
        title="List view"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 px-3',
          currentView === 'calendar' && 'bg-slate-100'
        )}
        onClick={() => setView('calendar')}
        title="Month view"
      >
        <CalendarDays className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 px-3',
          currentView === 'week' && 'bg-slate-100'
        )}
        onClick={() => setView('week')}
        title="Week view"
      >
        <CalendarRange className="h-4 w-4" />
      </Button>
    </div>
  );
}
