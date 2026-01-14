import { getRelatedExperiences } from '@/server/queries/experience.queries';
import { RelatedExperiences } from '@/components/features/experience/RelatedExperiences';
import type { ExperienceType } from '@prisma/client';

interface RelatedExperiencesSectionProps {
  experienceId: string;
  wineryId: string;
  experienceType: ExperienceType;
}

/**
 * Async server component that fetches related experiences.
 * Designed to be wrapped in Suspense for deferred loading.
 */
export async function RelatedExperiencesSection({
  experienceId,
  wineryId,
  experienceType,
}: RelatedExperiencesSectionProps) {
  const relatedExperiences = await getRelatedExperiences(
    experienceId,
    wineryId,
    experienceType,
    3
  );

  if (relatedExperiences.length === 0) {
    return null;
  }

  return (
    <div className="mt-16">
      <RelatedExperiences experiences={relatedExperiences} />
    </div>
  );
}
