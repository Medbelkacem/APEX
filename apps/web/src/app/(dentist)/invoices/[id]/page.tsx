'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AsyncSection, Skeleton } from '@/components/ui/data-states';
import { COL, RowMeta, Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { cn } from '@/lib/utils/cn';
import { InvoicePayment } from '@/components/forms/invoice-payment';
import { useApi } from '@/lib/hooks/use-api';
import { invoicesApi } from '@/lib/api/invoices';
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils/format';
import { INVOICE_TONES } from '@/lib/utils/invoice-status';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const invoice = useApi(() => invoicesApi.detail(id), [id]);

  return (
    <div className="space-y-6">
      <Link href="/invoices" className="text-sm text-slate-500 hover:text-blue-700">
        ← Back to invoices
      </Link>

      <AsyncSection
        loading={invoice.loading}
        error={invoice.error}
        data={invoice.data}
        skeleton={<Skeleton className="h-40 w-full" />}
      >
        {(entity) => (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{entity.number}</h1>
                  <Badge tone={INVOICE_TONES[entity.status]}>{entity.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Issued {formatDate(entity.issueDate)}
                  {entity.dueDate && ` · due ${formatDate(entity.dueDate)}`}
                </p>
              </div>
              <a href={invoicesApi.pdfUrl(entity.id)} className={buttonClasses('outline', 'md')}>
                Download PDF
              </a>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card>
                  <h2 className="text-lg font-semibold text-slate-900">Line items</h2>
                  <div className="mt-4">
                    <TableWrap className="border-0">
                      <Table className="sm:min-w-[30rem]">
                        <thead>
                          <tr>
                            <Th>Description</Th>
                            <Th className={cn(COL.sm, 'text-right')}>Qty</Th>
                            <Th className={cn(COL.sm, 'text-right')}>Unit price</Th>
                            <Th className="text-right">Amount</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {(entity.lineItems ?? []).map((item) => (
                            <Tr key={item.id}>
                              <Td>
                                {item.description}
                                {/* Restates the two columns a phone drops. */}
                                <RowMeta className="sm:hidden">
                                  {item.quantity} × {formatMoney(item.unitPrice, entity.currency)}
                                </RowMeta>
                              </Td>
                              <Td className={cn(COL.sm, 'text-right')}>{item.quantity}</Td>
                              <Td className={cn(COL.sm, 'text-right')}>
                                {formatMoney(item.unitPrice, entity.currency)}
                              </Td>
                              <Td className="text-right font-medium text-slate-900">
                                {formatMoney(item.total, entity.currency)}
                              </Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Table>
                    </TableWrap>
                  </div>

                  <dl className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Subtotal</dt>
                      <dd className="text-slate-900">
                        {formatMoney(entity.subtotal, entity.currency)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Tax</dt>
                      <dd className="text-slate-900">{formatMoney(entity.tax, entity.currency)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold">
                      <dt className="text-slate-900">Total</dt>
                      <dd className="text-slate-900">
                        {formatMoney(entity.total, entity.currency)}
                      </dd>
                    </div>
                  </dl>
                </Card>
              </div>

              <div className="space-y-6">
                {entity.status === 'issued' && (
                  <Card>
                    <h2 className="text-lg font-semibold text-slate-900">Pay this invoice</h2>
                    <p className="mb-4 mt-1 text-sm text-slate-500">
                      {formatMoney(entity.total, entity.currency)} due
                      {entity.dueDate && ` by ${formatDate(entity.dueDate)}`}.
                    </p>
                    <InvoicePayment invoiceId={entity.id} onPaid={invoice.refresh} />
                  </Card>
                )}

                {entity.status === 'paid' && (
                  <Card className="border-emerald-200 bg-emerald-50">
                    <h2 className="text-lg font-semibold text-emerald-900">Paid</h2>
                    <p className="mt-1 text-sm text-emerald-800">
                      Settled on {formatDateTime(entity.paidAt)}. Thank you.
                    </p>
                  </Card>
                )}

                {entity.case && (
                  <Card>
                    <h2 className="text-lg font-semibold text-slate-900">Related case</h2>
                    <Link
                      href={`/cases/${entity.case.id}`}
                      className="mt-2 block font-medium text-blue-700 hover:underline"
                    >
                      {entity.case.reference}
                    </Link>
                    <p className="text-sm text-slate-500">{entity.case.patientReference}</p>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}
      </AsyncSection>
    </div>
  );
}
