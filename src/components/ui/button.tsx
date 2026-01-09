import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, HTMLMotionProps } from 'framer-motion';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-b from-burgundy-600 to-burgundy-700 text-white shadow-md shadow-burgundy-900/10 hover:from-burgundy-500 hover:to-burgundy-600 hover:shadow-lg hover:shadow-burgundy-900/15 hover:-translate-y-0.5 active:translate-y-0',
        destructive:
          'bg-red-500 text-white hover:bg-red-600 hover:-translate-y-0.5 active:translate-y-0',
        outline:
          'border-2 border-burgundy-300 text-burgundy-700 hover:bg-burgundy-50',
        secondary:
          'bg-cream-100 text-burgundy-800 border border-burgundy-200 hover:bg-burgundy-50 hover:border-burgundy-300',
        ghost: 'text-burgundy-700 hover:bg-burgundy-50',
        link: 'text-burgundy-600 underline-offset-4 hover:text-burgundy-800 decoration-gold-400 hover:underline',
      },
      size: {
        default: 'h-11 px-6 py-2.5',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-12 px-8 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

// Spring animation variants for buttons
const buttonSpring = {
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 25,
};

export interface MotionButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'ref'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const MotionButton = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    if (asChild) {
      // For asChild, fall back to regular Button
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...(props as React.HTMLAttributes<HTMLElement>)}
        />
      );
    }

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        variants={buttonSpring}
        whileHover="hover"
        whileTap="tap"
        transition={springTransition}
        {...props}
      />
    );
  }
);
MotionButton.displayName = 'MotionButton';

export { Button, MotionButton, buttonVariants };
