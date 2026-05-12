'use client';

import { Clock, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ExperienceDetailsProps {
  description: string;
  duration: number;
  minCapacity: number;
  maxCapacity: number;
}

export function ExperienceDetails({
  description,
  duration,
  minCapacity,
  maxCapacity,
}: ExperienceDetailsProps) {
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

  const formatCapacity = (min: number, max: number): string => {
    if (min === max) {
      return t('capacitySingle', { count: min });
    }
    return t('capacityRange', { min, max });
  };

  return (
    <section className="rounded-xl bg-white p-6 shadow-warm lg:p-8">
      <h2 className="font-display text-xl font-semibold text-slate-900">
        {t('aboutTitle')}
      </h2>

      {/* Quick Info */}
      <div className="mt-4 flex flex-wrap gap-4">
        <div
          className="flex items-center gap-2 rounded-lg bg-burgundy-50 px-4 py-2"
          data-testid="experience-duration"
        >
          <Clock className="h-5 w-5 text-burgundy-600" />
          <span className="text-sm font-medium text-burgundy-900">
            {formatDuration(duration)}
          </span>
        </div>
        <div
          className="flex items-center gap-2 rounded-lg bg-burgundy-50 px-4 py-2"
          data-testid="experience-capacity"
        >
          <Users className="h-5 w-5 text-burgundy-600" />
          <span className="text-sm font-medium text-burgundy-900">
            {formatCapacity(minCapacity, maxCapacity)}
          </span>
        </div>
      </div>

      {/* Description */}
      <div
        className="prose prose-slate mt-6 max-w-none"
        data-testid="experience-description"
      >
        <p className="whitespace-pre-wrap leading-relaxed text-slate-600">
          {description}
        </p>
      </div>
    </section>
  );
}
