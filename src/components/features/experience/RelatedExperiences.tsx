'use client';

import { useTranslations } from 'next-intl';
import { ExperienceCard } from '@/components/features/experience/ExperienceCard';
import type { ExperienceCardData } from '@/components/features/experience/ExperienceCard';

interface RelatedExperiencesProps {
  experiences: ExperienceCardData[];
  title?: string;
}

export function RelatedExperiences({
  experiences,
  title,
}: RelatedExperiencesProps) {
  const t = useTranslations('experience');

  return (
    <section data-testid="related-experiences">
      <h2 className="font-display text-2xl font-semibold text-slate-900">
        {title ?? t('youMightAlsoLike')}
      </h2>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {experiences.map((experience) => (
          <ExperienceCard key={experience.id} experience={experience} />
        ))}
      </div>
    </section>
  );
}
