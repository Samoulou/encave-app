import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';

export default async function PayoutsLoading() {
  const t = await getTranslations('Payouts');

  return (
    <SkeletonContainer
      label={t('loading')}
      className="mx-auto max-w-4xl space-y-4"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-xl" />
      ))}
    </SkeletonContainer>
  );
}
