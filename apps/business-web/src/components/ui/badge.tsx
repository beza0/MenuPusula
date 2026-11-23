import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary-soft text-primary',
      neutral: 'border-transparent bg-muted text-foreground',
      success: 'border-transparent bg-green-50 text-success',
      danger: 'border-transparent bg-red-50 text-danger',
      warning: 'border-transparent bg-amber-50 text-amber-800',
      outline: 'bg-white',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
