import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva('rounded-lg border p-3 text-sm', {
  variants: {
    variant: {
      info: 'border-sky-200 bg-sky-50 text-sky-900',
      warning: 'border-amber-200 bg-amber-50 text-amber-900',
      danger: 'border-red-200 bg-red-50 text-red-900',
      success: 'border-green-200 bg-green-50 text-green-900',
    },
  },
  defaultVariants: { variant: 'info' },
});

export function Alert({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role={variant === 'danger' ? 'alert' : 'status'} className={cn(alertVariants({ variant }), className)} {...props} />;
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}
