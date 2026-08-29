import { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          // 16px text below `sm` keeps iOS Safari from zooming the viewport in
          // when the control takes focus; see the note in field.tsx.
          'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm sm:text-sm',
          'focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
          className,
        )}
        {...props}
      />
    );
  },
);
