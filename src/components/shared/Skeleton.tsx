import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base skeleton loading component with accessibility support.
 * Individual skeletons are decorative (aria-hidden), but should be wrapped
 * in a container with aria-busy="true" and aria-live="polite" for screen readers.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton-warm animate-skeleton-shimmer rounded-md',
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * Wrapper component for skeleton loaders with proper accessibility attributes.
 * Use this to wrap skeleton content to announce loading state to screen readers.
 */
interface SkeletonContainerProps {
  children: React.ReactNode;
  label?: string;
  className?: string;
}

export function SkeletonContainer({
  children,
  label = 'Chargement en cours...',
  className,
}: SkeletonContainerProps) {
  return (
    <div
      className={className}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

// Pre-built skeleton patterns for common use cases

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6">
      {/* Image placeholder */}
      <Skeleton className="aspect-[4/3] w-full rounded-lg" />

      {/* Content */}
      <div className="mt-4 space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-4 pt-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonExperienceGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };
  return <Skeleton className={cn('rounded-full', sizeClasses[size])} />;
}

export function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-11 w-32 rounded-lg', className)} />;
}

export function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-4 border-b border-stone-200 py-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-24 rounded-md" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-stone-200">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} />
      ))}
    </div>
  );
}

export function SkeletonDashboardStats() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-stone-200 bg-white p-6"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-8 w-16" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
