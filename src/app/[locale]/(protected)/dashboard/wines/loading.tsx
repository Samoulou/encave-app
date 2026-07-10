import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';

export default async function WinesLoading() {
  const t = await getTranslations('Dashboard.wines');

  return (
    <SkeletonContainer
      label={t('loading')}
      className="mx-auto max-w-4xl space-y-6"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </SkeletonContainer>
  );
}
