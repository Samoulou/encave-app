'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedGridProps {
  children: ReactNode;
  className?: string;
  /** Delay in seconds before starting the animation */
  delayChildren?: number;
  /** Stagger delay in seconds between each item */
  staggerChildren?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export function AnimatedGrid({
  children,
  className,
  delayChildren = 0.1,
  staggerChildren = 0.08,
}: AnimatedGridProps) {
  return (
    <motion.div
      className={cn('grid', className)}
      variants={{
        ...containerVariants,
        visible: {
          ...containerVariants.visible,
          transition: {
            staggerChildren,
            delayChildren,
          },
        },
      }}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 30,
    },
  },
};

interface AnimatedGridItemProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedGridItem({
  children,
  className,
}: AnimatedGridItemProps) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
