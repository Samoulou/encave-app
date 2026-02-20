import { Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';

export default function MyBookingsLoading() {
  return (
    <SkeletonContainer label="Loading bookings..." className="space-y-8">
      <Skeleton className="h-8 w-48" />

      {/* Upcoming section */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-36" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-stone-200 bg-white p-6 flex items-center gap-4"
          >
            <Skeleton className="hidden sm:block h-16 w-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-5 w-5 rounded" />
          </div>
        ))}
      </div>

      {/* Past section */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-28" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-stone-200 bg-white p-6 flex items-center gap-4"
          >
            <Skeleton className="hidden sm:block h-16 w-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-5 w-5 rounded" />
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}
