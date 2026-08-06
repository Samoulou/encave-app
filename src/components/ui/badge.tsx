import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-muted text-muted-foreground',
        outline: 'border-border text-foreground',
        // Status variants use the semantic --success/--warning/--error tokens
        // (not raw Tailwind palette scales) so they stay on the warm brand.
        success: 'border-success/25 bg-success/10 text-success',
        warning: 'border-warning/25 bg-warning/10 text-warning',
        destructive: 'border-error/25 bg-error/10 text-error',
        // Warm primary tint — the on-brand replacement for the cold "blue"
        // slot (e.g. a completed booking or an in-flight transaction).
        info: 'border-primary/20 bg-primary-light text-primary',
        // Warm neutral (stone/ink) for inactive states (NO_SHOW, DRAFT).
        neutral: 'border-stone-300 bg-stone-100 text-ink-700',
        gold: 'border-transparent bg-gradient-to-r from-gold-400 to-gold-500 text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
