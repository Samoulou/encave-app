import { SkeletonExperienceGrid, Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';

export default function ExperiencesLoading() {
  return (
    <div className="bg-cream-50">
      <SkeletonContainer
        label="Chargement des expériences..."
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      >
        {/* Header skeleton */}
        <div className="mb-8 text-center">
          <Skeleton className="mx-auto h-10 w-64" />
          <Skeleton className="mx-auto mt-3 h-5 w-96" />
        </div>

        {/* Search & filters skeleton */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Skeleton className="h-12 w-full lg:w-96" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        {/* Grid skeleton */}
        <SkeletonExperienceGrid count={9} />
      </SkeletonContainer>
    </div>
  );
}
