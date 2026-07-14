import { Skeleton } from '@/components/shared/Skeleton';

/**
 * Fiche skeleton (P-12 / L-220): a layout-matching skeleton replaces the
 * former full-page spinner — the fiche never shows a skeleton AND a loader at
 * once anymore.
 */
export default function Loading() {
  return (
    <div
      className="min-h-screen bg-cream-50"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:pb-14 lg:pt-5">
        {/* Gallery */}
        <Skeleton className="h-[280px] w-full rounded-2xl sm:h-[420px]" />

        <div className="grid grid-cols-1 gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
          {/* Main content */}
          <div className="space-y-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <div className="grid gap-4 border-y border-stone-200 py-5 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>

          {/* Reservation panel */}
          <div className="hidden lg:block">
            <Skeleton className="h-[420px] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
