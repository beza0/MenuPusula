import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-base sm:text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-20 w-full rounded-lg border bg-white px-3 py-2 text-base sm:text-sm placeholder:text-muted-foreground disabled:opacity-50 aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn('flex h-10 w-full rounded-lg border bg-white px-3 text-base sm:text-sm disabled:opacity-50', className)}
      {...props}
    />
  ),
);
NativeSelect.displayName = 'NativeSelect';
