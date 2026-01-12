'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  children: React.ReactNode;
  loadingText?: string;
  pendingOverride?: boolean;
}

/**
 * A submit button that automatically shows loading state when form is pending.
 * Prevents double-submit by disabling while form is submitting.
 *
 * Uses React's useFormStatus hook for automatic pending detection.
 * Pass pendingOverride=true for manual control of loading state.
 */
export function SubmitButton({
  children,
  loadingText,
  pendingOverride,
  disabled,
  className,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isPending = pendingOverride ?? pending;

  return (
    <Button
      type="submit"
      disabled={isPending || disabled}
      className={cn(className)}
      aria-busy={isPending}
      {...props}
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          {loadingText || children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
