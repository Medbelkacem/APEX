'use client';

import { FormEvent, useState } from 'react';
import { NotificationType } from '@dental/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input, Label, Textarea } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { AsyncSection, EmptyState, Spinner } from '@/components/ui/data-states';
import { Pagination } from '@/components/ui/pagination';
import { useApi } from '@/lib/hooks/use-api';
import { dentistsApi } from '@/lib/api/admin';
import { notificationsApi } from '@/lib/api/notifications';
import { formatDateTime } from '@/lib/utils/format';
import type { NotificationRecord } from '@/lib/api/types';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/** Badge tone per delivery status. */
const STATUS_TONES: Record<string, Tone> = {
  pending: 'warning',
  sent: 'success',
  failed: 'danger',
  read: 'neutral',
};

/** The admin log joins the recipient's account; the shared record stops at userId. */
type LogRow = NotificationRecord & {
  user?: { firstName: string; lastName: string; email: string } | null;
};

const EMPTY_FORM = { audience: 'one' as 'one' | 'all', userId: '', subject: '', message: '' };

/** Enum values reach the UI as snake_case; render them as prose. */
const humanize = (value: string) =>
  value.replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase());

export default function AdminNotificationsPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string }>();

  const [filters, setFilters] = useState({ type: '', page: 1 });

  const patch = (next: Partial<typeof filters>) =>
    // Any filter change resets to page 1 — otherwise you can land on an empty page.
    setFilters((prev) => ({ ...prev, ...next, page: next.page ?? 1 }));

  // One page of active dentists is enough for a picker; the roster is small.
  const dentists = useApi(() => dentistsApi.list({ status: 'active', limit: 100 }), []);
  const log = useApi(
    () => notificationsApi.log({ type: filters.type || undefined, page: filters.page }),
    [filters.type, filters.page],
  );

  async function send(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setNotice(undefined);
    try {
      const result = await notificationsApi.send({
        ...(form.audience === 'all' ? { broadcast: true } : { userId: form.userId }),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setForm((f) => ({ ...f, subject: '', message: '' }));
      setNotice({
        tone: 'success',
        text: `Message delivered to ${result.recipients} ${
          result.recipients === 1 ? 'recipient' : 'recipients'
        }.`,
      });
      log.refresh();
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not send the message',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Send announcements to dentists and review everything the platform has delivered.
        </p>
      </div>

      <form onSubmit={send} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Send message</h2>
        <p className="mt-1 text-sm text-slate-500">
          Recipients get the message in their notification feed and by email.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="audience">Send to</Label>
            <Select
              id="audience"
              value={form.audience}
              onChange={(e) =>
                setForm((f) => ({ ...f, audience: e.target.value as typeof f.audience }))
              }
            >
              <option value="one">One dentist</option>
              <option value="all">All active dentists</option>
            </Select>
          </div>
          {form.audience === 'one' && (
            <div>
              <Label htmlFor="recipient">Dentist</Label>
              <Select
                id="recipient"
                value={form.userId}
                onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                required
              >
                <option value="">Select a dentist…</option>
                {/* The API addresses recipients by user id, not dentist id. */}
                {dentists.data?.data.map((dentist) => (
                  <option key={dentist.id} value={dentist.user.id}>
                    {dentist.user.firstName} {dentist.user.lastName}
                    {dentist.clinicName ? ` — ${dentist.clinicName}` : ''}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="sm:col-span-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              maxLength={255}
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              maxLength={5000}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              required
            />
          </div>
        </div>

        {dentists.error && (
          <div className="mt-4">
            <Alert tone="error">{dentists.error}</Alert>
          </div>
        )}
        {notice && (
          <div className="mt-4">
            <Alert tone={notice.tone}>{notice.text}</Alert>
          </div>
        )}

        <div className="mt-5">
          <Button type="submit" disabled={sending}>
            {sending && <Spinner className="mr-2" />}
            {form.audience === 'all' ? 'Send to all dentists' : 'Send message'}
          </Button>
        </div>
      </form>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Delivery log</h2>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="sm:max-w-xs">
            <Label htmlFor="type">Type</Label>
            <Select
              id="type"
              value={filters.type}
              onChange={(e) => patch({ type: e.target.value })}
            >
              <option value="">All types</option>
              {Object.values(NotificationType).map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <AsyncSection
        loading={log.loading}
        error={log.error}
        data={log.data}
        isEmpty={(page) => page.data.length === 0}
        empty={
          <TableWrap>
            <EmptyState
              title="Nothing delivered yet"
              description="Messages sent by the platform and by staff show up here."
            />
          </TableWrap>
        }
      >
        {(page) => (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Type</Th>
                  <Th>Subject</Th>
                  <Th>Recipient</Th>
                  <Th>Status</Th>
                  <Th>Sent</Th>
                </tr>
              </thead>
              <tbody>
                {(page.data as LogRow[]).map((row) => (
                  <Tr key={row.id}>
                    <Td className="whitespace-nowrap">{humanize(row.type)}</Td>
                    <Td className="font-medium text-slate-900">{row.subject}</Td>
                    <Td>
                      {row.user ? (
                        <>
                          <span className="block">
                            {row.user.firstName} {row.user.lastName}
                          </span>
                          <span className="block text-xs text-slate-500">{row.user.email}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONES[row.status] ?? 'neutral'}>{row.status}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap">{formatDateTime(row.sentAt ?? row.createdAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={page.meta} onChange={(p) => patch({ page: p })} />
          </TableWrap>
        )}
      </AsyncSection>
    </div>
  );
}
