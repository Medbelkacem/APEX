'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button, buttonClasses } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Label, Textarea } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { AsyncSection, Skeleton, Spinner } from '@/components/ui/data-states';
import { FileDropzone, UploadProgressBar } from '@/components/forms/file-dropzone';
import { CaseTimeline } from '@/components/case-timeline';
import { useApi } from '@/lib/hooks/use-api';
import { casesApi, uploadCaseFiles } from '@/lib/api/cases';
import { catalogApi } from '@/lib/api/catalog';
import { dentistsApi } from '@/lib/api/admin';
import { invoicesApi } from '@/lib/api/invoices';
import { formatBytes, formatDate, formatDateTime, formatMoney } from '@/lib/utils/format';
import { INVOICE_TONES } from '@/lib/utils/invoice-status';
import { Badge } from '@/components/ui/badge';

export default function AdminCaseDetailPage() {
  const { id } = useParams<{ id: string }>();

  const detail = useApi(() => casesApi.detail(id), [id]);
  const timeline = useApi(() => casesApi.timeline(id), [id]);
  const files = useApi(() => casesApi.files(id), [id]);
  const statuses = useApi(() => catalogApi.statuses(), []);
  const dentists = useApi(() => dentistsApi.list({ limit: 100 }), []);
  // Invoices are filtered client-side to this case: the list endpoint scopes by
  // dentist, not by case, and a dentist's invoice count stays small.
  const invoices = useApi(
    () =>
      detail.data
        ? invoicesApi.list({ dentistId: detail.data.dentistId, limit: 100 })
        : Promise.resolve(undefined),
    [detail.data?.dentistId],
  );

  const [statusId, setStatusId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();

  const [reassignTo, setReassignTo] = useState('');
  const [labFiles, setLabFiles] = useState<File[]>([]);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);

  /** Run a mutation with consistent busy/message handling. */
  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    setMessage(undefined);
    try {
      await action();
      setMessage({ tone: 'success', text: success });
      detail.refresh();
      timeline.refresh();
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'The action could not be completed',
      });
    } finally {
      setBusy(null);
    }
  }

  const caseInvoices = invoices.data?.data.filter((invoice) => invoice.caseId === id) ?? [];

  return (
    <div className="space-y-6">
      <Link href="/admin/cases" className="text-sm text-slate-500 hover:text-blue-700">
        ← Back to cases
      </Link>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <AsyncSection
        loading={detail.loading}
        error={detail.error}
        data={detail.data}
        skeleton={<Skeleton className="h-40 w-full" />}
      >
        {(entity) => (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{entity.reference}</h1>
                  {entity.currentStatus && (
                    <StatusBadge
                      label={entity.currentStatus.label}
                      color={entity.currentStatus.color}
                    />
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {entity.caseType?.name} ·{' '}
                  {entity.dentist?.user
                    ? `${entity.dentist.user.firstName} ${entity.dentist.user.lastName}`
                    : 'Unknown dentist'}
                  {entity.dentist?.clinicName ? ` (${entity.dentist.clinicName})` : ''}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <h2 className="text-lg font-semibold text-slate-900">Case details</h2>
                  <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                    {[
                      ['Patient reference', entity.patientReference],
                      ['Case type', entity.caseType?.name ?? '—'],
                      ['Tooth / region', entity.toothRegion ?? '—'],
                      ['Material', entity.material ?? '—'],
                      ['Shade', entity.shade ?? '—'],
                      ['Deadline', formatDate(entity.deadline)],
                      ['Submitted', formatDateTime(entity.submittedAt)],
                      ['Completed', formatDateTime(entity.completedAt)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-slate-500">{label}</dt>
                        <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {entity.clinicalNotes && (
                    <div className="mt-6 border-t border-slate-100 pt-4">
                      <h3 className="text-sm font-medium text-slate-500">
                        Clinical notes from the dentist
                      </h3>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-800">
                        {entity.clinicalNotes}
                      </p>
                    </div>
                  )}
                </Card>

                <Card>
                  <h2 className="text-lg font-semibold text-slate-900">Files</h2>
                  <AsyncSection
                    loading={files.loading}
                    error={files.error}
                    data={files.data}
                    skeleton={<Skeleton className="mt-4 h-16 w-full" />}
                  >
                    {(rows) => (
                      <ul className="mt-4 divide-y divide-slate-100">
                        {rows.length === 0 && (
                          <li className="py-4 text-sm text-slate-500">No files attached.</li>
                        )}
                        {rows.map((file) => (
                          <li
                            key={file.id}
                            className="flex flex-wrap items-center justify-between gap-3 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {file.originalFilename}
                              </p>
                              <p className="text-xs text-slate-500">
                                {file.fileType === 'lab_output' ? 'Lab deliverable' : 'Dentist upload'}{' '}
                                · {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
                              </p>
                            </div>
                            <a
                              href={casesApi.fileUrl(id, file.id)}
                              className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                            >
                              Download
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </AsyncSection>

                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <h3 className="mb-3 text-sm font-medium text-slate-700">
                      Attach a lab deliverable
                    </h3>
                    <FileDropzone
                      files={labFiles}
                      onChange={setLabFiles}
                      disabled={busy === 'upload'}
                      hint="Finished-work scans, design files, or documents for the dentist"
                    />
                    {uploadPercent !== null && <UploadProgressBar percent={uploadPercent} />}
                    {labFiles.length > 0 && (
                      <div className="mt-4">
                        <Button
                          disabled={busy === 'upload'}
                          onClick={() =>
                            run(
                              'upload',
                              async () => {
                                setUploadPercent(0);
                                try {
                                  // Tagged lab_output so the dentist sees it as a
                                  // deliverable and cannot delete it.
                                  await uploadCaseFiles(id, labFiles, {
                                    fileType: 'lab_output',
                                    onProgress: (p) => setUploadPercent(p.percent),
                                  });
                                  setLabFiles([]);
                                  files.refresh();
                                } finally {
                                  setUploadPercent(null);
                                }
                              },
                              'Deliverable uploaded.',
                            )
                          }
                        >
                          {busy === 'upload' && <Spinner className="mr-2" />}
                          Upload {labFiles.length} file{labFiles.length === 1 ? '' : 's'}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">Invoicing</h2>
                    {caseInvoices.length === 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy === 'invoice'}
                        onClick={() =>
                          run(
                            'invoice',
                            () => invoicesApi.generateForCase(id).then(() => invoices.refresh()),
                            'Draft invoice generated.',
                          )
                        }
                      >
                        {busy === 'invoice' && <Spinner className="mr-2" />}
                        Generate invoice
                      </Button>
                    )}
                  </div>

                  {caseInvoices.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">
                      No invoice has been raised for this case yet.
                    </p>
                  ) : (
                    <ul className="mt-4 divide-y divide-slate-100">
                      {caseInvoices.map((invoice) => (
                        <li
                          key={invoice.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3"
                        >
                          <div>
                            <Link
                              href={`/admin/invoices/${invoice.id}`}
                              className="font-medium text-blue-700 hover:underline"
                            >
                              {invoice.number}
                            </Link>
                            <span className="ml-2 text-sm text-slate-500">
                              {formatMoney(invoice.total, invoice.currency)}
                            </span>
                          </div>
                          <Badge tone={INVOICE_TONES[invoice.status]}>{invoice.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <h2 className="text-lg font-semibold text-slate-900">Advance workflow</h2>
                  <div className="mt-4 space-y-3">
                    <div>
                      <Label htmlFor="status">Move to status</Label>
                      <Select
                        id="status"
                        value={statusId}
                        onChange={(e) => setStatusId(e.target.value)}
                      >
                        <option value="">Select a status…</option>
                        {statuses.data?.map((s) => (
                          <option key={s.id} value={s.id} disabled={s.id === entity.currentStatusId}>
                            {s.label}
                            {s.id === entity.currentStatusId ? ' (current)' : ''}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="note">Internal note (visible to the dentist)</Label>
                      <Textarea
                        id="note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="e.g. Milling complete, moving to glaze"
                        className="min-h-[80px]"
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={!statusId || busy === 'status'}
                      onClick={() =>
                        run(
                          'status',
                          async () => {
                            await casesApi.changeStatus(id, statusId, note || undefined);
                            setStatusId('');
                            setNote('');
                          },
                          'Case status updated and the dentist notified.',
                        )
                      }
                    >
                      {busy === 'status' && <Spinner className="mr-2" />}
                      Update status
                    </Button>
                  </div>
                </Card>

                <Card>
                  <h2 className="text-lg font-semibold text-slate-900">Status timeline</h2>
                  <AsyncSection
                    loading={timeline.loading}
                    error={timeline.error}
                    data={timeline.data}
                    skeleton={<Skeleton className="mt-4 h-32 w-full" />}
                  >
                    {(entries) => <CaseTimeline entries={entries} />}
                  </AsyncSection>
                </Card>

                <Card>
                  <h2 className="text-lg font-semibold text-slate-900">Reassign</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Move this case to a different dentist account.
                  </p>
                  <div className="mt-4 space-y-3">
                    <Select
                      aria-label="Reassign to dentist"
                      value={reassignTo}
                      onChange={(e) => setReassignTo(e.target.value)}
                    >
                      <option value="">Select a dentist…</option>
                      {dentists.data?.data
                        .filter((d) => d.id !== entity.dentistId)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.user.firstName} {d.user.lastName}
                            {d.clinicName ? ` — ${d.clinicName}` : ''}
                          </option>
                        ))}
                    </Select>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={!reassignTo || busy === 'reassign'}
                      onClick={() =>
                        run(
                          'reassign',
                          async () => {
                            await casesApi.reassign(id, reassignTo);
                            setReassignTo('');
                          },
                          'Case reassigned.',
                        )
                      }
                    >
                      {busy === 'reassign' && <Spinner className="mr-2" />}
                      Reassign case
                    </Button>
                  </div>
                </Card>

                <Card>
                  <h2 className="text-lg font-semibold text-slate-900">Dentist</h2>
                  {entity.dentist && (
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
                      <Link
                        href={`/admin/dentists/${entity.dentistId}`}
                        className={buttonClasses('outline', 'sm') + ' mt-3'}
                      >
                        View dentist
                      </Link>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </AsyncSection>
    </div>
  );
}
