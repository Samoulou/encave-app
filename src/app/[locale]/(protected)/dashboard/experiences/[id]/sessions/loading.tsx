import { Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';
import { getTranslations } from 'next-intl/server';

export default async function OccurrenceCalendarLoading() {
  const t = await getTranslations('Dashboard.eventDetail');

  return (
    <SkeletonContainer
      label={t('occurrences.loading')}
      className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:gap-8 md:py-10"
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-40" />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={`head-${index}`} className="bg-stone-50 p-2">
            <Skeleton className="mx-auto h-3 w-8" />
          </div>
        ))}
        {Array.from({ length: 35 }).map((_, index) => (
          <div key={`day-${index}`} className="min-h-[72px] bg-white p-1.5">
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}
