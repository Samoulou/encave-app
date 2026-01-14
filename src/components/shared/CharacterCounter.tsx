import { cn } from '@/lib/utils';

interface CharacterCounterProps {
  /** Current character count */
  current: number;
  /** Maximum allowed characters */
  max: number;
  /** Minimum required characters (optional) */
  min?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Character counter component for text inputs and textareas
 * Shows current/max count with color-coded feedback:
 * - Red: Over limit
 * - Amber: Near limit (>90%)
 * - Gray: Normal
 */
export function CharacterCounter({
  current,
  max,
  min = 0,
  className,
}: CharacterCounterProps) {
  const isBelowMin = current < min;
  const isNearMax = current > max * 0.9;
  const isOverMax = current > max;

  return (
    <span
      className={cn(
        'text-sm tabular-nums',
        isOverMax && 'font-medium text-red-600',
        isNearMax && !isOverMax && 'text-amber-600',
        isBelowMin && 'text-slate-500',
        !isBelowMin && !isNearMax && 'text-slate-400',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {current.toLocaleString()}/{max.toLocaleString()}
      {min > 0 && current < min && (
        <span className="ml-1 text-slate-400">(min {min})</span>
      )}
    </span>
  );
}
