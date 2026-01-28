import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-[#a62444] hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:-translate-y-0.5 active:translate-y-0',
        outline:
          'border-2 border-border text-foreground hover:bg-accent hover:border-primary/50',
        secondary:
          'bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:border-primary/30',
        ghost: 'text-foreground hover:bg-accent',
        link: 'text-primary underline-offset-4 hover:text-[#a62444] hover:underline',
      },
      size: {
        default: 'h-10 px-6 py-2.5',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-12 px-8 text-base',
        xl: 'h-14 px-10 text-base',
        icon: 'h-10 w-10',
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
  isLoading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, loadingText, children, disabled, ...props }, ref) => {
    // When loading, use button element (not Slot) to show spinner
    if (isLoading) {
      return (
        <button
          className={cn(buttonVariants({ variant, size, className }), 'cursor-wait')}
          ref={ref}
          disabled
          aria-busy="true"
          {...props}
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{loadingText || children}</span>
        </button>
      );
    }

    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
