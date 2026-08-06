import { cn } from '@/lib/utils';

interface AnimatedProgressBarProps {
  /** Progress value from 0 to 100 */
  progress: number;
  className?: string;
}

/**
 * Progress bar that animates its width from 0 to `progress` on mount —
 * pure CSS (keyframe in tailwind.config.ts), replaces the former
 * framer-motion implementation (L-206).
 */
export function AnimatedProgressBar({
  progress,
  className,
}: AnimatedProgressBarProps) {
  return (
    <div className={cn('h-1.5 bg-stone-100', className)}>
      <div
        className="h-full animate-progress-grow rounded-r-full bg-burgundy-600"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
