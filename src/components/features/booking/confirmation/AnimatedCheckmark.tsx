'use client';

import { cn } from '@/lib/utils';

interface AnimatedCheckmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AnimatedCheckmark({
  className,
  size = 'lg',
}: AnimatedCheckmarkProps) {
  const sizeClasses = {
    sm: 'size-12',
    md: 'size-16',
    lg: 'size-20',
  };

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-green-50 text-green-600',
        sizeClasses[size],
        className
      )}
    >
      <svg className={iconSizes[size]} viewBox="0 0 52 52">
        <circle
          className="checkmark-circle"
          cx="26"
          cy="26"
          r="25"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0"
        />
        <path
          className="checkmark-check"
          d="M14.1 27.2l7.1 7.2 16.7-16.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <style jsx>{`
        .checkmark-circle {
          animation: circle-stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }
        .checkmark-check {
          transform-origin: 50% 50%;
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: check-stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s
            forwards;
        }
        @keyframes circle-stroke {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes check-stroke {
          100% {
            stroke-dashoffset: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .checkmark-circle,
          .checkmark-check {
            animation: none;
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
