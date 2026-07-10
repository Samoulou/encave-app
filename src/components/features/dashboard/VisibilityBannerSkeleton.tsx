import { Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';

/**
 * Skeleton placeholder for the dashboard visibility banner (ENC-027).
 *
 * Fixed height matches the populated layout so the page does not jump
 * when the banner streams in.
 */
export function VisibilityBannerSkeleton() {
  return (
    <SkeletonContainer
      label="Chargement du statut de visibilité..."
      className="rounded-xl border border-stone-200 bg-card p-5 sm:p-6"
    >
      <div className="min-h-[260px] space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />

        <div className="space-y-2.5 pt-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ))}
        </div>

        <div className="pt-4">
          <Skeleton className="h-11 w-full rounded-lg sm:w-48" />
        </div>
      </div>
    </SkeletonContainer>
  );
}
