import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-slate-900 ring-offset-white transition-all duration-200',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-slate-400 placeholder:italic',
          'hover:border-stone-400',
          'focus:border-burgundy-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-500/20',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-stone-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
