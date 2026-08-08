'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button, buttonClasses } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AsyncSection, Skeleton, Spinner } from '@/components/ui/data-states';
import { COL, RowMeta, Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { cn } from '@/lib/utils/cn';
import { useApi } from '@/lib/hooks/use-api';
import { invoicesApi } from '@/lib/api/invoices';
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils/format';
import { INVOICE_TONES } from '@/lib/utils/invoice-status';

export default function AdminInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const invoice = useApi(() => invoicesApi.detail(id), [id]);

  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();

  /** Run a lifecycle mutation with consistent busy/message handling. */
  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    setMessage(undefined);
    try {
      await action();
      setMessage({ tone: 'success', text: success });
      invoice.refresh();
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'The action could not be completed',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/invoices" className="text-sm text-slate-500 hover:text-brand-700">
        ← Back to invoices
      </Link>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

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
                <Card>
                  <h2 className="text-lg font-semibold text-slate-900">Actions</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {entity.status === 'draft' &&
                      'Issuing locks the invoice and emails it to the dentist.'}
                    {entity.status === 'issued' &&
                      'Record an offline payment, or cancel if the invoice was raised in error.'}
                    {entity.status === 'paid' && `Settled on ${formatDateTime(entity.paidAt)}.`}
                    {entity.status === 'cancelled' && 'This invoice was cancelled.'}
                    {entity.status === 'refunded' && 'This invoice was refunded.'}
                  </p>

                  <div className="mt-4 space-y-2">
                    {entity.status === 'draft' && (
                      <Button
                        className="w-full"
                        disabled={busy === 'issue'}
                        onClick={() =>
                          run('issue', () => invoicesApi.issue(entity.id), 'Invoice issued.')
                        }
                      >
                        {busy === 'issue' && <Spinner className="mr-2" />}
                        Issue
                      </Button>
                    )}
                    {entity.status === 'issued' && (
                      <>
                        <Button
                          className="w-full"
                          disabled={busy === 'paid'}
                          onClick={() =>
                            run(
                              'paid',
                              () => invoicesApi.markPaid(entity.id),
                              'Invoice marked as paid.',
                            )
                          }
                        >
                          {busy === 'paid' && <Spinner className="mr-2" />}
                          Mark paid
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={busy === 'cancel'}
                          onClick={() =>
                            run('cancel', () => invoicesApi.cancel(entity.id), 'Invoice cancelled.')
                          }
                        >
                          {busy === 'cancel' && <Spinner className="mr-2" />}
                          Cancel
                        </Button>
                      </>
                    )}
                    {entity.status === 'paid' && (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={busy === 'refund'}
                        onClick={() =>
                          run('refund', () => invoicesApi.refund(entity.id), 'Invoice refunded.')
                        }
                      >
                        {busy === 'refund' && <Spinner className="mr-2" />}
                        Refund
                      </Button>
                    )}
                  </div>
                </Card>

                {entity.dentist && (
                  <Card>
                    <h2 className="text-lg font-semibold text-slate-900">Billed to</h2>
                    <div className="mt-3 space-y-1 text-sm">
                      <p className="font-medium text-slate-900">
                        {entity.dentist.user?.firstName} {entity.dentist.user?.lastName}
                      </p>
                      {entity.dentist.clinicName && (
                        <p className="text-slate-600">{entity.dentist.clinicName}</p>
                      )}
                      {entity.dentist.user?.email && (
                        <p className="text-slate-500">{entity.dentist.user.email}</p>
                      )}
                      {entity.dentist.billingAddress && (
                        <p className="whitespace-pre-wrap text-slate-500">
                          {entity.dentist.billingAddress}
                        </p>
                      )}
                      <Link
                        href={`/admin/dentists/${entity.dentistId}`}
                        className={buttonClasses('outline', 'sm') + ' mt-3'}
                      >
                        View dentist
                      </Link>
                    </div>
                  </Card>
                )}

                {entity.case && (
                  <Card>
                    <h2 className="text-lg font-semibold text-slate-900">Related case</h2>
                    <Link
                      href={`/admin/cases/${entity.case.id}`}
                      className="mt-2 block font-medium text-brand-700 hover:underline"
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
