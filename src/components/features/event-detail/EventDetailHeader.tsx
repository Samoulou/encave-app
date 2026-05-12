import { getTranslations } from 'next-intl/server';
import { ExperienceStatus } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { ContactGuestsButton } from './ContactGuestsButton';
import type { EventDetailDTO } from '@/types/event-detail';

interface EventDetailHeaderProps {
  event: EventDetailDTO;
}

const STATUS_VARIANT: Record<
  ExperienceStatus,
  'secondary' | 'success' | 'outline'
> = {
  [ExperienceStatus.DRAFT]: 'secondary',
  [ExperienceStatus.PUBLISHED]: 'success',
  [ExperienceStatus.ARCHIVED]: 'outline',
};

const STATUS_KEY: Record<ExperienceStatus, 'draft' | 'published' | 'archived'> =
  {
    [ExperienceStatus.DRAFT]: 'draft',
    [ExperienceStatus.PUBLISHED]: 'published',
    [ExperienceStatus.ARCHIVED]: 'archived',
  };

export async function EventDetailHeader({ event }: EventDetailHeaderProps) {
  const t = await getTranslations('Dashboard.eventDetail');
  const { experience } = event;

  return (
    <header className="flex flex-col gap-4">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-slate-500"
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-1 hover:text-slate-900"
        >
          <Home className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Dashboard</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/dashboard/experiences" className="hover:text-slate-900">
          {t('breadcrumb', { title: '' }).split('/')[1]?.trim() ?? 'Events'}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="truncate font-medium text-slate-900">
          {experience.title}
        </span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              {experience.title}
            </h1>
            <Badge variant={STATUS_VARIANT[experience.status]}>
              {t(`status.${STATUS_KEY[experience.status]}`)}
            </Badge>
          </div>
          <p className="text-sm text-slate-500" aria-live="polite">
            {t('summary.active', {
              confirmed: event.totalConfirmedSeats,
              total: event.totalActiveCapacity,
              sessions: event.activeSessionsCount,
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ContactGuestsButton />
        </div>
      </div>
    </header>
  );
}
