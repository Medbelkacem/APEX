import { cn } from '@/lib/utils/cn';
import { Alert } from '@/components/ui/alert';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  );
}

/** Grey placeholder bar used while table/card content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-200', className)} />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-4 flex-1', c === 0 && 'max-w-[8rem]')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-12 text-center sm:px-6 sm:py-16">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Renders the right thing for an async slice of UI: error, loading, empty, or
 * content — so pages don't each re-implement the same four branches.
 */
export function AsyncSection<T>({
  loading,
  error,
  data,
  isEmpty,
  empty,
  skeleton,
  children,
}: {
  loading: boolean;
  error?: string;
  data: T | undefined;
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
  skeleton?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}) {
  if (error) return <Alert tone="error">{error}</Alert>;
  if (loading && data === undefined) return <>{skeleton ?? <TableSkeleton />}</>;
  if (data === undefined) return null;
  if (isEmpty?.(data)) return <>{empty ?? <EmptyState title="Nothing to show yet" />}</>;
  return <>{children(data)}</>;
}
