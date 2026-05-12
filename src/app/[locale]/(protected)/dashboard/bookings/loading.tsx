import { getTranslations } from 'next-intl/server';
import {
  SkeletonDashboardStats,
  SkeletonTable,
  Skeleton,
  SkeletonContainer,
} from '@/components/shared/Skeleton';

export default async function BookingsLoading() {
  const t = await getTranslations('bookings');

  return (
    <SkeletonContainer label={t('loading')} className="space-y-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <SkeletonDashboardStats />
      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <SkeletonTable rows={8} />
      </div>
    </SkeletonContainer>
  );
}
