'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface TemplateProps {
  children: ReactNode;
}

const pageVariants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

const pageTransition = {
  duration: 0.3,
  ease: [0.16, 1, 0.3, 1] as const, // --ease-out
};

export default function Template({ children }: TemplateProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
}
