'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input, Label } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { COL, RowMeta, Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { AsyncSection, EmptyState } from '@/components/ui/data-states';
import { Pagination } from '@/components/ui/pagination';
import { useApi } from '@/lib/hooks/use-api';
import { invoicesApi, type InvoiceListQuery } from '@/lib/api/invoices';
import { formatDate, formatMoney } from '@/lib/utils/format';
import { INVOICE_TONES } from '@/lib/utils/invoice-status';

export default function DentistInvoicesPage() {
  const [filters, setFilters] = useState<InvoiceListQuery>({
    status: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 20,
  });

  const patch = (next: Partial<InvoiceListQuery>) =>
    setFilters((prev) => ({ ...prev, ...next, page: next.page ?? 1 }));

  const invoices = useApi(
    () => invoicesApi.list(filters),
    [filters.status, filters.dateFrom, filters.dateTo, filters.page],
  );
  const balance = useApi(() => invoicesApi.outstanding(), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">
            Download invoices and settle outstanding balances online.
          </p>
        </div>
        {balance.data && balance.data.count > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            <span className="font-semibold">
              {formatMoney(balance.data.total, balance.data.currency)}
            </span>{' '}
            outstanding across {balance.data.count}{' '}
            {balance.data.count === 1 ? 'invoice' : 'invoices'}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={filters.status ?? ''}
              onChange={(e) => patch({ status: e.target.value })}
            >
              <option value="">All statuses</option>
              <option value="issued">Outstanding</option>
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
              title="No invoices yet"
              description="Invoices appear here once the laboratory has issued them."
            />
          </TableWrap>
        }
      >
        {(page) => (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th className={COL.md}>Issued</Th>
                  <Th className={COL.md}>Due</Th>
                  <Th className={COL.sm}>Status</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {page.data.map((invoice) => (
                  <Tr key={invoice.id}>
                    <Td>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {invoice.number}
                      </Link>
                      {/* Carries the dates, and the status until `sm` restores it. */}
                      <RowMeta className="md:hidden">
                        <span className="sm:hidden">{invoice.status} · </span>
                        {formatDate(invoice.issueDate)}
                        {invoice.dueDate && ` · due ${formatDate(invoice.dueDate)}`}
                      </RowMeta>
                    </Td>
                    <Td className={COL.md}>{formatDate(invoice.issueDate)}</Td>
                    <Td className={COL.md}>{formatDate(invoice.dueDate)}</Td>
                    <Td className={COL.sm}>
                      <Badge tone={INVOICE_TONES[invoice.status]}>{invoice.status}</Badge>
                    </Td>
                    <Td className="text-right font-medium text-slate-900">
                      {formatMoney(invoice.total, invoice.currency)}
                    </Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <a
                          href={invoicesApi.pdfUrl(invoice.id)}
                          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                        >
                          PDF
                        </a>
                        {invoice.status === 'issued' && (
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                          >
                            Pay
                          </Link>
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
