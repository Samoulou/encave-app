'use client';

import { motion } from 'framer-motion';
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

// SVG checkmark path animation
const checkmarkVariants = {
  hidden: {
    pathLength: 0,
    opacity: 0,
  },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 20,
        delay: 0.3,
      },
      opacity: { duration: 0.01 },
    },
  },
};

// Container scale animation
const containerVariants = {
  hidden: {
    scale: 0,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 20,
    },
  },
};

// Glow pulse animation
const glowVariants = {
  hidden: {
    scale: 0.8,
    opacity: 0,
  },
  visible: {
    scale: [1, 1.2, 1],
    opacity: [0.3, 0.5, 0.3],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
};

export function SuccessCheckmark({ className, size = 'md' }: SuccessCheckmarkProps) {
  const { container, icon, strokeWidth } = sizeMap[size];

  return (
    <div className={cn('relative inline-flex', className)}>
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full bg-green-400/30 blur-xl"
        variants={glowVariants}
        initial="hidden"
        animate="visible"
      />

      {/* Circle container */}
      <motion.div
        className={cn(
          container,
          'relative flex items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-500 shadow-lg shadow-green-500/25'
        )}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Checkmark SVG */}
        <svg
          width={icon}
          height={icon}
          viewBox="0 0 24 24"
          fill="none"
          className="text-white"
        >
          <motion.path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={checkmarkVariants}
            initial="hidden"
            animate="visible"
          />
        </svg>
      </motion.div>
    </div>
  );
}
