import { SkeletonExperienceGrid } from '@/components/shared/Skeleton';

export default function ExperiencesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="h-10 w-40 animate-pulse rounded-lg bg-stone-200" />
      </div>
      <SkeletonExperienceGrid count={6} />
    </div>
  );
}
