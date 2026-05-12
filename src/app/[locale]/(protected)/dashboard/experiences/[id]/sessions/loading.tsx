import { Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';
import { getTranslations } from 'next-intl/server';

export default async function EventDetailLoading() {
  const t = await getTranslations('Dashboard.eventDetail');

  return (
    <SkeletonContainer
      label={t('title')}
      className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:gap-8 md:py-10"
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-40" />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>

      {/* Sessions */}
      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: 2 }).map((__, cardIndex) => (
            <div
              key={cardIndex}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-9 w-32 rounded-md" />
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {Array.from({ length: 3 }).map((___, rowIndex) => (
                  <Skeleton key={rowIndex} className="h-10 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </SkeletonContainer>
  );
}
