import { SkeletonDashboardStats, SkeletonTable } from '@/components/shared/Skeleton';

export default function BookingsLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-stone-200" />
      </div>
      <SkeletonDashboardStats />
      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <SkeletonTable rows={8} />
      </div>
    </div>
  );
}
