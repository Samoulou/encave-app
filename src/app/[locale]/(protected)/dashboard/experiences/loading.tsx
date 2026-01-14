import { SkeletonExperienceGrid, Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';

export default function ExperiencesLoading() {
  return (
    <SkeletonContainer label="Chargement des expériences..." className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
      <SkeletonExperienceGrid count={6} />
    </SkeletonContainer>
  );
}
