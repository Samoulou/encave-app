import * as React from 'react';

import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[120px] w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-slate-900 ring-offset-white transition-all duration-200',
        'placeholder:text-slate-500',
        'hover:border-stone-400',
        'focus:border-burgundy-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-500/20',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-stone-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
