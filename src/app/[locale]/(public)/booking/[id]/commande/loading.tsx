import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';

export default async function WineOrderLoading() {
  const t = await getTranslations('wineOrder');

  return (
    <div className="min-h-screen bg-cream-50 px-4 py-10">
      <SkeletonContainer label={t('loading')} className="mx-auto max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="mt-4 h-14 w-full rounded-xl" />
      </SkeletonContainer>
    </div>
  );
}
