'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionGroup } from '@/types/event-detail';

interface SessionGroupSectionProps {
  group: SessionGroup;
  title: string;
  count: number;
  defaultOpen?: boolean;
  emptyLabel?: string;
  children: React.ReactNode;
}

/**
 * Collapsible section per group. Today/upcoming open by default; past and
 * cancelled collapsed.
 */
export function SessionGroupSection({
  group,
  title,
  count,
  defaultOpen,
  emptyLabel,
  children,
}: SessionGroupSectionProps) {
  const [open, setOpen] = useState<boolean>(
    defaultOpen ?? (group === 'today' || group === 'upcoming')
  );

  if (count === 0 && (group === 'today' || group === 'upcoming')) {
    return null;
  }

  return (
    <section aria-labelledby={`group-${group}`} className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors',
          'hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
        )}
      >
        <h2
          id={`group-${group}`}
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          {title}
          <span className="ml-2 text-sm font-medium text-muted-foreground">
            ({count})
          </span>
        </h2>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="flex flex-col gap-4">
          {count === 0 && emptyLabel ? (
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            children
          )}
        </div>
      ) : null}
    </section>
  );
}
