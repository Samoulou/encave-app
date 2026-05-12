'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedProgressBarProps {
  /** Progress value from 0 to 100 */
  progress: number;
  className?: string;
}

export function AnimatedProgressBar({
  progress,
  className,
}: AnimatedProgressBarProps) {
  return (
    <div className={cn('h-1.5 bg-stone-100', className)}>
      <motion.div
        className="h-full rounded-r-full bg-burgundy-600"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{
          duration: 0.5,
          ease: [0.16, 1, 0.3, 1], // --ease-out
        }}
      />
    </div>
  );
}
