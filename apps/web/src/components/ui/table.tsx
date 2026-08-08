import { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Column visibility tiers.
 *
 * A phone cannot show seven columns, and a table that only scrolls sideways is
 * barely usable with a thumb. Each table therefore tags its lower-priority
 * columns with one of these, and they reappear as the viewport grows. Anything
 * hidden on a phone is either repeated inside the row's lead cell or available
 * on the record's own page, so no fact becomes unreachable.
 */
export const COL = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
} as const;

/** Wrapper that keeps wide tables scrollable instead of breaking the layout. */
export function TableWrap({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-xl border border-slate-200 bg-white',
        className,
      )}
      {...props}
    />
  );
}

/** True when the caller has already pinned a minimum width of its own. */
function setsMinWidth(className: string): boolean {
  return /(^|\s)(\w+:)?min-w-/.test(className);
}

export function Table({ className = '', ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn(
        'w-full text-left text-sm',
        /*
         * The floor only applies from `md`. Below it the table has dropped its
         * `COL.*` columns, so the survivors fit a phone with no sideways
         * scrolling — a min-width there would reintroduce exactly that. Emitted
         * only when the caller has not set its own, because equal-specificity
         * Tailwind utilities are resolved by stylesheet order, not class order.
         */
        setsMinWidth(className) ? null : 'md:min-w-[40rem]',
        className,
      )}
      {...props}
    />
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-4',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('border-b border-slate-100 px-3 py-3 text-slate-700 sm:px-4', className)}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-slate-50', className)} {...props} />;
}

/**
 * The facts a row's hidden columns were carrying, folded under its lead cell so
 * a phone still shows them. Mirrors the breakpoint that hides those columns.
 */
export function RowMeta({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-0.5 text-xs text-slate-500', className)} {...props} />;
}
