import { formatDateTime } from '@/lib/utils/format';
import type { CaseTimelineEntry } from '@/lib/api/types';

/** Vertical status history for a case, oldest first. */
export function CaseTimeline({ entries }: { entries: CaseTimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">No status changes recorded yet.</p>;
  }

  return (
    <ol className="mt-4 space-y-0">
      {entries.map((entry, index) => {
        const last = index === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Connector line, omitted on the final entry. */}
            {!last && (
              <span
                className="absolute left-[5px] top-4 h-full w-px bg-slate-200"
                aria-hidden="true"
              />
            )}
            <span
              className="relative mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white"
              style={{ backgroundColor: entry.caseStatus.color }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{entry.caseStatus.label}</p>
              <p className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</p>
              {entry.note && <p className="mt-1 text-sm text-slate-600">{entry.note}</p>}
              {entry.changedByUser && (
                <p className="mt-0.5 text-xs text-slate-400">
                  by {entry.changedByUser.firstName} {entry.changedByUser.lastName}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
