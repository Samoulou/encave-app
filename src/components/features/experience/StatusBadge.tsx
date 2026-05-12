import { cn } from '@/lib/utils';
import type { ExperienceStatus } from '@prisma/client';

interface StatusBadgeProps {
  status: ExperienceStatus;
  className?: string;
}

const STATUS_CONFIG = {
  DRAFT: {
    label: 'Draft',
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
  },
  PUBLISHED: {
    label: 'Published',
    badge: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-500',
  },
  ARCHIVED: {
    label: 'Archived',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
} as const;

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold backdrop-blur-sm',
        config.badge,
        className
      )}
    >
      <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}
