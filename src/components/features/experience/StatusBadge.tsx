'use client';

import { useTranslations } from 'next-intl';
import type { ExperienceStatus } from '@prisma/client';
import { Badge, type BadgeProps } from '@/components/ui/badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

interface StatusBadgeProps {
  status: ExperienceStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  ExperienceStatus,
  { variant: BadgeVariant; labelKey: string }
> = {
  DRAFT: { variant: 'neutral', labelKey: 'draft' },
  PUBLISHED: { variant: 'success', labelKey: 'published' },
  ARCHIVED: { variant: 'warning', labelKey: 'archived' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const t = useTranslations('common.status');
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant={config.variant} className={className}>
      {t(config.labelKey)}
    </Badge>
  );
}
