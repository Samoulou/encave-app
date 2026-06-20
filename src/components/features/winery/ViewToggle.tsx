'use client';

import { useQueryState } from 'nuqs';
import { Grid3X3, Map } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export type ViewMode = 'grid' | 'map';

interface ViewToggleProps {
  className?: string;
}

export function ViewToggle({ className }: ViewToggleProps) {
  const t = useTranslations('wineries');
  const [view, setView] = useQueryState('view', {
    defaultValue: 'grid',
    shallow: true,
  });

  const current = view === 'map' ? 'map' : 'grid';

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-stone-200 bg-white p-0.5 shadow-sm',
        className
      )}
      role="radiogroup"
      aria-label="View mode"
    >
      <button
        type="button"
        role="radio"
        aria-checked={current === 'grid'}
        onClick={() => setView('grid')}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          current === 'grid'
            ? 'bg-burgundy-50 text-burgundy-700'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Grid3X3 className="h-4 w-4" />
        {t('gridView')}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={current === 'map'}
        onClick={() => setView('map')}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          current === 'map'
            ? 'bg-burgundy-50 text-burgundy-700'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Map className="h-4 w-4" />
        {t('mapView')}
      </button>
    </div>
  );
}

export function useViewMode(): ViewMode {
  const [view] = useQueryState('view', {
    defaultValue: 'grid',
    shallow: true,
  });
  return view === 'map' ? 'map' : 'grid';
}
