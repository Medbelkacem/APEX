'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/hooks/use-api';
import { notificationsApi } from '@/lib/api/notifications';
import { timeAgo } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/** How often the unread badge re-checks the server. */
const POLL_MS = 60_000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const unread = useApi(() => notificationsApi.unreadCount(), [tick]);
  const list = useApi(
    () => (open ? notificationsApi.list({ limit: 8 }) : Promise.resolve(undefined)),
    [open, tick],
  );

  // Light polling keeps the badge fresh without a websocket.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const count = unread.data?.count ?? 0;

  async function markAllRead() {
    await notificationsApi.markAllRead().catch(() => undefined);
    setTick((t) => t + 1);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
        aria-label={count > 0 ? `Notifications (${count} unread)` : 'Notifications'}
        aria-expanded={open}
      >
        <span aria-hidden="true" className="text-lg leading-none">
          🔔
        </span>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-red-500 px-1 text-[0.65rem] font-semibold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {count > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {list.loading && <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>}
            {list.data?.data.length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-500">You&apos;re all caught up.</p>
            )}
            {list.data?.data.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'border-b border-slate-50 px-4 py-3 last:border-0',
                  !item.readAt && 'bg-brand-50/50',
                )}
              >
                <p className="text-sm font-medium text-slate-900">{item.subject}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{item.body}</p>
                <p className="mt-1 text-xs text-slate-400">{timeAgo(item.createdAt)}</p>
                {item.relatedCaseId && (
                  <Link
                    href={`/cases/${item.relatedCaseId}`}
                    onClick={() => setOpen(false)}
                    className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline"
                  >
                    View case
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
