import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-5 text-xs px-1.5 gap-0.5',
  md: 'h-6 text-xs px-2 gap-1',
  lg: 'h-7 text-sm px-2.5 gap-1',
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

export function VerifiedBadge({
  size = 'md',
  showLabel = true,
  className,
}: VerifiedBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-gradient-to-r from-gold-400 to-gold-500 text-gold-950 font-medium shadow-sm',
        sizeClasses[size],
        className
      )}
    >
      <CheckCircle className={iconSizes[size]} />
      {showLabel && <span>Verified</span>}
    </span>
  );
}
