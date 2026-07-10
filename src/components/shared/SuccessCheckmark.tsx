import { cn } from '@/lib/utils';

interface SuccessCheckmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { container: 'h-12 w-12', icon: 24, strokeWidth: 2.5 },
  md: { container: 'h-20 w-20', icon: 40, strokeWidth: 2.5 },
  lg: { container: 'h-28 w-28', icon: 56, strokeWidth: 2 },
};

/**
 * Animated success checkmark — pure CSS (keyframes in tailwind.config.ts),
 * replaces the former framer-motion implementation (L-206).
 * The path draw uses pathLength={1} so stroke-dasharray/offset can be
 * animated with normalized values.
 */
export function SuccessCheckmark({
  className,
  size = 'md',
}: SuccessCheckmarkProps) {
  const { container, icon, strokeWidth } = sizeMap[size];

  return (
    <div className={cn('relative inline-flex', className)}>
      {/* Glow effect */}
      <div className="absolute inset-0 animate-checkmark-glow rounded-full bg-green-400/30 blur-xl" />

      {/* Circle container */}
      <div
        className={cn(
          container,
          'relative flex animate-checkmark-pop items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-500 shadow-lg shadow-green-500/25'
        )}
      >
        {/* Checkmark SVG */}
        <svg
          width={icon}
          height={icon}
          viewBox="0 0 24 24"
          fill="none"
          className="text-white"
        >
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1}
            className="animate-checkmark-draw"
          />
        </svg>
      </div>
    </div>
  );
}
