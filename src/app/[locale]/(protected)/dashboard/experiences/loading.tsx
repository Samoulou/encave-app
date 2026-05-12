import { getTranslations } from 'next-intl/server';
import {
  SkeletonExperienceGrid,
  Skeleton,
  SkeletonContainer,
} from '@/components/shared/Skeleton';

export default async function ExperiencesLoading() {
  const t = await getTranslations('experience');

  return (
    <SkeletonContainer label={t('loading')} className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
      <SkeletonExperienceGrid count={6} />
    </SkeletonContainer>
  );
}
