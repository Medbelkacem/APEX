import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Tailwind utilities of equal specificity are resolved by stylesheet order, not
 * by the order they appear in the class attribute — so a caller passing
 * `bg-brand-700` would silently lose to the `bg-white` default below and render
 * an invisible white-on-white panel. Each default is therefore emitted only
 * when the caller has not already set that group. Prefixed variants
 * (`hover:bg-…`) deliberately do not count as an override.
 */
function overrides(className: string, prefix: string): boolean {
  return new RegExp(`(^|\\s)${prefix}`).test(className);
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm',
        overrides(className, 'border-') ? null : 'border-slate-200',
        overrides(className, 'bg-') ? null : 'bg-white',
        overrides(className, 'p-') ? null : 'p-6',
        className,
      )}
      {...props}
    />
  );
}

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)} {...props} />;
}
