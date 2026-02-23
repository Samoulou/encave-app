import { getTranslations } from 'next-intl/server';
import { SkeletonDashboardStats, Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';

export default async function EarningsLoading() {
  const t = await getTranslations('earnings');

  return (
    <SkeletonContainer label={t('loading')} className="space-y-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <SkeletonDashboardStats />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      </div>
    </SkeletonContainer>
  );
}
