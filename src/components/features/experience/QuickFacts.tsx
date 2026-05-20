'use client';

import { Clock, Users, GraduationCap, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ExperienceType } from '@prisma/client';

interface QuickFactsProps {
  duration: number;
  maxCapacity: number;
  type: ExperienceType;
}

export function QuickFacts({
  duration,
  maxCapacity,
  type,
}: QuickFactsProps) {
  const t = useTranslations('experience');

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return t('durationMinutes', { count: minutes });
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return t('durationFormat', { count: hours });
    }
    return `${t('durationFormat', { count: hours })} ${t('durationMinutes', { count: remainingMinutes })}`;
  };

  return (
    <div className="flex flex-wrap gap-3 border-b border-[#f2e9eb] pb-6">
      <div className="flex items-center gap-2 rounded-lg bg-primary-light px-3 py-2 text-foreground">
        <Clock className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium" data-testid="experience-duration">
          {formatDuration(duration)}
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-primary-light px-3 py-2 text-foreground">
        <Users className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium" data-testid="experience-capacity">
          {t('maxGuests2', { count: maxCapacity })}
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-primary-light px-3 py-2 text-foreground">
        <GraduationCap className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium" data-testid="experience-type-badge">
          {t(`typesDetailed.${type}`)}
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-primary-light px-3 py-2 text-foreground">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium">{t('ageGate.badge')}</span>
      </div>
    </div>
  );
}
