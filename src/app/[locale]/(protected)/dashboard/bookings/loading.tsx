import { SkeletonDashboardStats, SkeletonTable, Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';

export default function BookingsLoading() {
  return (
    <SkeletonContainer label="Chargement des réservations..." className="space-y-8">
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
