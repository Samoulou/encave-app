import { getTranslations } from 'next-intl/server';
import { ExperienceStatus } from '@prisma/client';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventStatusBannerProps {
  status: ExperienceStatus;
}

export async function EventStatusBanner({ status }: EventStatusBannerProps) {
  if (status === ExperienceStatus.PUBLISHED) return null;

  const t = await getTranslations('Dashboard.eventDetail.banner');

  const isDraft = status === ExperienceStatus.DRAFT;
  const Icon = isDraft ? Info : AlertTriangle;

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        isDraft
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-border bg-muted text-muted-foreground'
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <p>{isDraft ? t('draft') : t('archived')}</p>
    </div>
  );
}
