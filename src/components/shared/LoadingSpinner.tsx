import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

export function LoadingSpinner({ size = 'md', className, label }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <Loader2
        className={cn('animate-spin text-burgundy-600', sizeClasses[size])}
        aria-hidden="true"
      />
      {label && <span className="text-sm text-slate-600">{label}</span>}
      <span className="sr-only">{label || 'Loading...'}</span>
    </div>
  );
}

interface PageLoadingProps {
  label?: string;
}

export function PageLoading({ label }: PageLoadingProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center">
      <LoadingSpinner size="lg" label={label} />
    </div>
  );
}

export function FullPageLoading({ label }: PageLoadingProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream-50">
      <LoadingSpinner size="xl" label={label} />
    </div>
  );
}
