'use client';

import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface CreateExperienceCardProps {
  className?: string;
}

export function CreateExperienceCard({ className }: CreateExperienceCardProps) {
  const t = useTranslations('experience');

  return (
    <Link
      href="/dashboard/experiences/new"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl p-8',
        'border-2 border-dashed border-primary/30 hover:border-primary',
        'bg-primary-light/40 hover:bg-primary-light/80',
        'group min-h-[360px] cursor-pointer gap-4 transition-all',
        className
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-white shadow-sm transition-transform group-hover:scale-110">
        <Plus className="h-8 w-8 text-primary" aria-hidden="true" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">
          {t('createNewExperience')}
        </h3>
        <p className="mt-1 max-w-[200px] text-sm text-muted-foreground">
          {t('createCardSubtitle')}
        </p>
      </div>
    </Link>
  );
}
