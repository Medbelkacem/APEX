'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input, Label } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { AsyncSection, EmptyState, Spinner } from '@/components/ui/data-states';
import { Pagination } from '@/components/ui/pagination';
import { useApi } from '@/lib/hooks/use-api';
import { invoicesApi, type InvoiceListQuery } from '@/lib/api/invoices';
import { dentistsApi } from '@/lib/api/admin';
import { formatDate, formatMoney } from '@/lib/utils/format';
import { INVOICE_TONES } from '@/lib/utils/invoice-status';

const EMPTY_BATCH = { dentistId: '', dateFrom: '', dateTo: '' };

function AdminInvoicesView() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<InvoiceListQuery>({
    status: '',
    // Seeded from the URL so "All invoices" links from a dentist's page land
    // pre-filtered to that dentist.
    dentistId: params.get('dentistId') ?? '',
    search: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 20,
  });

  const patch = (next: Partial<InvoiceListQuery>) =>
    // Any filter change resets to page 1 — otherwise you can land on an empty page.
    setFilters((prev) => ({ ...prev, ...next, page: next.page ?? 1 }));

  // A large practice list would need a typeahead; the flat list is fine at
  // laboratory scale and keeps the filter row synchronous.
  const dentists = useApi(() => dentistsApi.list({ limit: 100 }), []);
  const invoices = useApi(
    () => invoicesApi.list(filters),
    [
      filters.status,
      filters.dentistId,
      filters.search,
      filters.dateFrom,
      filters.dateTo,
      filters.page,
    ],
  );

  const [showBatch, setShowBatch] = useState(false);
  const [batch, setBatch] = useState(EMPTY_BATCH);
  const [batchError, setBatchError] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();

  /** Run a lifecycle mutation with consistent busy/message handling. */
  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    setMessage(undefined);
    try {
      await action();
      setMessage({ tone: 'success', text: success });
      invoices.refresh();
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'The action could not be completed',
      });
    } finally {
      setBusy(null);
    }
  }

  async function generateBatch(event: FormEvent) {
    event.preventDefault();
    setBusy('batch');
    setBatchError(undefined);
    setMessage(undefined);
    try {
      const result = await invoicesApi.generateBatch({
        dentistId: batch.dentistId,
        // An open-ended range invoices every completed, uninvoiced case.
        dateFrom: batch.dateFrom || undefined,
        dateTo: batch.dateTo || undefined,
      });
      setBatch(EMPTY_BATCH);
      setShowBatch(false);
      setMessage({
        tone: 'success',
        text: result.created
          ? `Batch invoice created from ${result.created} case${result.created === 1 ? '' : 's'}.`
          : 'No completed, uninvoiced cases matched that range.',
      });
      invoices.refresh();
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : 'Could not generate the batch invoice');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">
            Raise, issue, and settle invoices across every dentist account.
          </p>
        </div>
        <Button
          variant={showBatch ? 'outline' : 'primary'}
          onClick={() => setShowBatch((open) => !open)}
        >
          {showBatch ? 'Cancel' : 'Generate batch invoice'}
        </Button>
      </div>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {showBatch && (
        <form
          onSubmit={generateBatch}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-900">Batch invoice</h2>
          <p className="mt-1 text-sm text-slate-500">
            Rolls a dentist’s completed, uninvoiced cases into a single draft invoice.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="batchDentist">Dentist</Label>
              <Select
                id="batchDentist"
                value={batch.dentistId}
                onChange={(e) => setBatch((b) => ({ ...b, dentistId: e.target.value }))}
                required
              >
                <option value="">Select a dentist…</option>
                {dentists.data?.data.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.user.firstName} {d.user.lastName}
                    {d.clinicName ? ` — ${d.clinicName}` : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="batchFrom">Completed from</Label>
              <Input
                id="batchFrom"
                type="date"
                value={batch.dateFrom}
                onChange={(e) => setBatch((b) => ({ ...b, dateFrom: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="batchTo">Completed to</Label>
              <Input
                id="batchTo"
                type="date"
                value={batch.dateTo}
                onChange={(e) => setBatch((b) => ({ ...b, dateTo: e.target.value }))}
              />
            </div>
          </div>

          {batchError && (
            <div className="mt-4">
              <Alert tone="error">{batchError}</Alert>
            </div>
          )}

          <div className="mt-5 flex items-center gap-2">
            <Button type="submit" disabled={!batch.dentistId || busy === 'batch'}>
              {busy === 'batch' && <Spinner className="mr-2" />}
              Generate invoice
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowBatch(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Invoice number, dentist, clinic…"
              value={filters.search ?? ''}
              onChange={(e) => patch({ search: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="dentist">Dentist</Label>
            <Select
              id="dentist"
              value={filters.dentistId ?? ''}
              onChange={(e) => patch({ dentistId: e.target.value })}
            >
              <option value="">All dentists</option>
              {dentists.data?.data.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.user.firstName} {d.user.lastName}
                  {d.clinicName ? ` — ${d.clinicName}` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={filters.status ?? ''}
              onChange={(e) => patch({ status: e.target.value })}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="dateFrom">Issued from</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) => patch({ dateFrom: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="dateTo">Issued to</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => patch({ dateTo: e.target.value })}
            />
          </div>
        </div>
      </div>

      <AsyncSection
        loading={invoices.loading}
        error={invoices.error}
        data={invoices.data}
        isEmpty={(page) => page.data.length === 0}
        empty={
          <TableWrap>
            <EmptyState
              title="No invoices match these filters"
              description="Try clearing the search, status, or date range."
            />
          </TableWrap>
        }
      >
        {(page) => (
          <TableWrap>
            <Table className="min-w-[52rem]">
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Dentist</Th>
                  <Th>Issued</Th>
                  <Th>Due</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Actions</Th>
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
                    </Td>
                    <Td>
                      {invoice.dentist?.user
                        ? `${invoice.dentist.user.firstName} ${invoice.dentist.user.lastName}`
                        : '—'}
                    </Td>
                    <Td>{formatDate(invoice.issueDate)}</Td>
                    <Td>{formatDate(invoice.dueDate)}</Td>
                    <Td>
                      <Badge tone={INVOICE_TONES[invoice.status]}>{invoice.status}</Badge>
                    </Td>
                    <Td className="text-right font-medium text-slate-900">
                      {formatMoney(invoice.total, invoice.currency)}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <a
                          href={invoicesApi.pdfUrl(invoice.id)}
                          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                        >
                          PDF
                        </a>
                        {invoice.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy === invoice.id}
                            onClick={() =>
                              run(
                                invoice.id,
                                () => invoicesApi.issue(invoice.id),
                                `${invoice.number} issued and emailed to the dentist.`,
                              )
                            }
                          >
                            Issue
                          </Button>
                        )}
                        {invoice.status === 'issued' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy === invoice.id}
                              onClick={() =>
                                run(
                                  invoice.id,
                                  () => invoicesApi.markPaid(invoice.id),
                                  `${invoice.number} marked as paid.`,
                                )
                              }
                            >
                              Mark paid
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy === invoice.id}
                              onClick={() =>
                                run(
                                  invoice.id,
                                  () => invoicesApi.cancel(invoice.id),
                                  `${invoice.number} cancelled.`,
                                )
                              }
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        {invoice.status === 'paid' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy === invoice.id}
                            onClick={() =>
                              run(
                                invoice.id,
                                () => invoicesApi.refund(invoice.id),
                                `${invoice.number} refunded.`,
                              )
                            }
                          >
                            Refund
                          </Button>
                        )}
                      </div>
                    </Td>
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

export default function AdminInvoicesPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense>
      <AdminInvoicesView />
    </Suspense>
  );
}
