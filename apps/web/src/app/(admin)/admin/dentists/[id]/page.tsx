'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Input, Label, Textarea } from '@/components/ui/field';
import { COL, RowMeta, Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { AsyncSection, EmptyState, Skeleton, Spinner } from '@/components/ui/data-states';
import { useApi } from '@/lib/hooks/use-api';
import { dentistsApi } from '@/lib/api/admin';
import { casesApi } from '@/lib/api/cases';
import { invoicesApi } from '@/lib/api/invoices';
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils/format';
import { INVOICE_TONES } from '@/lib/utils/invoice-status';
import { USER_STATUS_TONES } from '@/lib/utils/user-status';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  clinicName: '',
  clinicAddress: '',
  billingAddress: '',
  tier: '',
  notes: '',
};

/** Optional text fields go to the API as null, not '', so they clear properly. */
const orNull = (value: string) => value.trim() || null;

type Action = 'enable' | 'disable' | 'reset';

export default function AdminDentistDetailPage() {
  const { id } = useParams<{ id: string }>();

  const detail = useApi(() => dentistsApi.detail(id), [id]);
  // Only the latest slice of history is useful here; the full lists live on their own screens.
  const cases = useApi(() => casesApi.list({ dentistId: id, limit: 10 }), [id]);
  const invoices = useApi(() => invoicesApi.list({ dentistId: id, limit: 10 }), [id]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Action>();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();

  // Seed the form from the server record; re-seeding on cancel discards edits.
  useEffect(() => {
    const dentist = detail.data;
    if (!dentist || editing) return;
    setForm({
      firstName: dentist.user.firstName,
      lastName: dentist.user.lastName,
      phone: dentist.user.phone ?? '',
      clinicName: dentist.clinicName ?? '',
      clinicAddress: dentist.clinicAddress ?? '',
      billingAddress: dentist.billingAddress ?? '',
      tier: dentist.tier ?? '',
      notes: dentist.notes ?? '',
    });
  }, [detail.data, editing]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);
    try {
      await dentistsApi.update(id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: orNull(form.phone),
        clinicName: orNull(form.clinicName),
        clinicAddress: orNull(form.clinicAddress),
        billingAddress: orNull(form.billingAddress),
        tier: orNull(form.tier),
        notes: orNull(form.notes),
      });
      setEditing(false);
      setMessage({ tone: 'success', text: 'Dentist updated.' });
      detail.refresh();
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not save this dentist',
      });
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: Action, done: string) {
    setPending(action);
    setMessage(undefined);
    try {
      if (action === 'enable') await dentistsApi.enable(id);
      else if (action === 'disable') await dentistsApi.disable(id);
      else await dentistsApi.resetPassword(id);
      setMessage({ tone: 'success', text: done });
      if (action !== 'reset') detail.refresh();
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not complete that action',
      });
    } finally {
      setPending(undefined);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/dentists" className="text-sm text-slate-500 hover:text-brand-700">
          ← Back to dentists
        </Link>
      </div>

      <AsyncSection
        loading={detail.loading}
        error={detail.error}
        data={detail.data}
        skeleton={<Skeleton className="h-32 w-full" />}
      >
        {(dentist) => (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {dentist.user.firstName} {dentist.user.lastName}
                  </h1>
                  <Badge tone={USER_STATUS_TONES[dentist.user.status]}>{dentist.user.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {dentist.clinicName ?? 'No clinic recorded'} · joined{' '}
                  {formatDate(dentist.createdAt)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!editing && (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )}
                {dentist.user.status === 'disabled' ? (
                  <Button
                    variant="outline"
                    disabled={pending !== undefined}
                    onClick={() => runAction('enable', 'Account enabled.')}
                  >
                    {pending === 'enable' && <Spinner className="mr-2" />}
                    Enable
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={pending !== undefined}
                    onClick={() => runAction('disable', 'Account disabled.')}
                  >
                    {pending === 'disable' && <Spinner className="mr-2" />}
                    Disable
                  </Button>
                )}
                <Button
                  variant="ghost"
                  disabled={pending !== undefined}
                  onClick={() => runAction('reset', 'Password reset email sent.')}
                >
                  {pending === 'reset' && <Spinner className="mr-2" />}
                  Send password reset
                </Button>
              </div>
            </div>

            {message && (
              <div className="mt-4">
                <Alert tone={message.tone}>{message.text}</Alert>
              </div>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card>
                  <h2 className="text-lg font-semibold text-slate-900">Profile</h2>

                  {editing ? (
                    <form onSubmit={save} className="mt-5 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="firstName">First name</Label>
                          <Input
                            id="firstName"
                            value={form.firstName}
                            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="lastName">Last name</Label>
                          <Input
                            id="lastName"
                            value={form.lastName}
                            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            value={form.phone}
                            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <Label htmlFor="tier">Pricing tier</Label>
                          <Input
                            id="tier"
                            value={form.tier}
                            onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
                            placeholder="Optional"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label htmlFor="clinicName">Clinic name</Label>
                          <Input
                            id="clinicName"
                            value={form.clinicName}
                            onChange={(e) => setForm((f) => ({ ...f, clinicName: e.target.value }))}
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <Label htmlFor="clinicAddress">Clinic address</Label>
                          <Textarea
                            id="clinicAddress"
                            value={form.clinicAddress}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, clinicAddress: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="billingAddress">Billing address</Label>
                          <Textarea
                            id="billingAddress"
                            value={form.billingAddress}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, billingAddress: e.target.value }))
                            }
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label htmlFor="notes">Internal notes</Label>
                          <Textarea
                            id="notes"
                            value={form.notes}
                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                            placeholder="Only visible to laboratory staff"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button type="submit" disabled={saving}>
                          {saving && <Spinner className="mr-2" />}
                          Save changes
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                        {[
                          ['First name', dentist.user.firstName],
                          ['Last name', dentist.user.lastName],
                          ['Phone', dentist.user.phone ?? '—'],
                          ['Pricing tier', dentist.tier ?? '—'],
                          ['Clinic name', dentist.clinicName ?? '—'],
                          ['Clinic address', dentist.clinicAddress ?? '—'],
                          ['Billing address', dentist.billingAddress ?? '—'],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-slate-500">{label}</dt>
                            <dd className="mt-0.5 whitespace-pre-wrap font-medium text-slate-900">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      {dentist.notes && (
                        <div className="mt-6 border-t border-slate-100 pt-4">
                          <h3 className="text-sm font-medium text-slate-500">Internal notes</h3>
                          <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-800">
                            {dentist.notes}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              </div>

              <div>
                <Card>
                  <h2 className="text-lg font-semibold text-slate-900">Account</h2>
                  <dl className="mt-4 space-y-4 text-sm">
                    <div>
                      <dt className="text-slate-500">Email</dt>
                      <dd className="mt-0.5 break-all font-medium text-slate-900">
                        {dentist.user.email}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Status</dt>
                      <dd className="mt-1">
                        <Badge tone={USER_STATUS_TONES[dentist.user.status]}>
                          {dentist.user.status}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Last sign-in</dt>
                      <dd className="mt-0.5 font-medium text-slate-900">
                        {formatDateTime(dentist.user.lastLoginAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Created</dt>
                      <dd className="mt-0.5 font-medium text-slate-900">
                        {formatDateTime(dentist.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </Card>
              </div>
            </div>
          </>
        )}
      </AsyncSection>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Recent cases</h2>
          <Link
            href={`/admin/cases?dentistId=${id}`}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            All cases
          </Link>
        </div>
        <AsyncSection
          loading={cases.loading}
          error={cases.error}
          data={cases.data}
          isEmpty={(page) => page.data.length === 0}
          empty={<EmptyState title="No cases submitted yet" />}
        >
          {(page) => (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Reference</Th>
                    <Th className={COL.md}>Type</Th>
                    <Th className={COL.md}>Patient</Th>
                    <Th>Status</Th>
                    <Th className={COL.sm}>Submitted</Th>
                  </tr>
                </thead>
                <tbody>
                  {page.data.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <Link
                          href={`/admin/cases/${row.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {row.reference}
                        </Link>
                        {/* Carries the two columns a phone drops. */}
                        <RowMeta className="md:hidden">
                          {row.caseType?.name ?? '—'} · {row.patientReference}
                        </RowMeta>
                      </Td>
                      <Td className={COL.md}>{row.caseType?.name ?? '—'}</Td>
                      <Td className={COL.md}>{row.patientReference}</Td>
                      <Td>
                        {row.currentStatus && (
                          <StatusBadge
                            label={row.currentStatus.label}
                            color={row.currentStatus.color}
                          />
                        )}
                      </Td>
                      <Td className={COL.sm}>{formatDate(row.submittedAt)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </AsyncSection>
      </Card>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Recent invoices</h2>
          <Link
            href={`/admin/invoices?dentistId=${id}`}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            All invoices
          </Link>
        </div>
        <AsyncSection
          loading={invoices.loading}
          error={invoices.error}
          data={invoices.data}
          isEmpty={(page) => page.data.length === 0}
          empty={<EmptyState title="No invoices raised yet" />}
        >
          {(page) => (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Invoice</Th>
                    <Th className={COL.md}>Issued</Th>
                    <Th className={COL.md}>Due</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {page.data.map((invoice) => (
                    <Tr key={invoice.id}>
                      <Td>
                        <Link
                          href={`/admin/invoices/${invoice.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {invoice.number}
                        </Link>
                        {/* Carries the two date columns a phone drops. */}
                        <RowMeta className="md:hidden">
                          {formatDate(invoice.issueDate)}
                          {invoice.dueDate && ` · due ${formatDate(invoice.dueDate)}`}
                        </RowMeta>
                      </Td>
                      <Td className={COL.md}>{formatDate(invoice.issueDate)}</Td>
                      <Td className={COL.md}>{formatDate(invoice.dueDate)}</Td>
                      <Td>
                        <Badge tone={INVOICE_TONES[invoice.status]}>{invoice.status}</Badge>
                      </Td>
                      <Td className="text-right font-medium text-slate-900">
                        {formatMoney(invoice.total, invoice.currency)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </AsyncSection>
      </Card>
    </div>
  );
}
