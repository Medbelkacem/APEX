'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { AsyncSection, Skeleton, Spinner } from '@/components/ui/data-states';
import { FileDropzone, UploadProgressBar } from '@/components/forms/file-dropzone';
import { CaseTimeline } from '@/components/case-timeline';
import { useApi } from '@/lib/hooks/use-api';
import { casesApi, uploadCaseFiles } from '@/lib/api/cases';
import { formatBytes, formatDate, formatDateTime } from '@/lib/utils/format';

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();

  const detail = useApi(() => casesApi.detail(id), [id]);
  const timeline = useApi(() => casesApi.timeline(id), [id]);
  const files = useApi(() => casesApi.files(id), [id]);

  const [pending, setPending] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string>();

  async function upload() {
    if (!pending.length) return;
    setUploading(true);
    setFileError(undefined);
    setUploadPercent(0);
    try {
      await uploadCaseFiles(id, pending, { onProgress: (p) => setUploadPercent(p.percent) });
      setPending([]);
      files.refresh();
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadPercent(null);
    }
  }

  async function removeFile(fileId: string) {
    setFileError(undefined);
    try {
      await casesApi.removeFile(id, fileId);
      files.refresh();
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not remove the file');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/cases" className="text-sm text-slate-500 hover:text-brand-700">
          ← Back to cases
        </Link>
      </div>

      <AsyncSection
        loading={detail.loading}
        error={detail.error}
        data={detail.data}
        skeleton={<Skeleton className="h-32 w-full" />}
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
                  {entity.caseType?.name} · submitted {formatDate(entity.submittedAt)}
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
                      <h3 className="text-sm font-medium text-slate-500">Clinical notes</h3>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-800">
                        {entity.clinicalNotes}
                      </p>
                    </div>
                  )}
                </Card>

                <Card>
                  <h2 className="text-lg font-semibold text-slate-900">Files</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Your uploaded scans plus any deliverables produced by the laboratory.
                  </p>

                  {fileError && (
                    <div className="mt-4">
                      <Alert tone="error">{fileError}</Alert>
                    </div>
                  )}

                  <AsyncSection
                    loading={files.loading}
                    error={files.error}
                    data={files.data}
                    skeleton={<Skeleton className="mt-4 h-16 w-full" />}
                  >
                    {(rows) => (
                      <ul className="mt-4 divide-y divide-slate-100">
                        {rows.length === 0 && (
                          <li className="py-4 text-sm text-slate-500">No files attached yet.</li>
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
                                {file.fileType === 'lab_output' ? 'Lab deliverable' : 'Your upload'} ·{' '}
                                {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <a
                                href={casesApi.fileUrl(id, file.id)}
                                className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                              >
                                Download
                              </a>
                              {file.fileType !== 'lab_output' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(file.id)}
                                  aria-label={`Remove ${file.originalFilename}`}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </AsyncSection>

                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <h3 className="mb-3 text-sm font-medium text-slate-700">Add more files</h3>
                    <FileDropzone files={pending} onChange={setPending} disabled={uploading} />
                    {uploadPercent !== null && <UploadProgressBar percent={uploadPercent} />}
                    {pending.length > 0 && (
                      <div className="mt-4">
                        <Button onClick={upload} disabled={uploading}>
                          {uploading && <Spinner className="mr-2" />}
                          {uploading
                            ? 'Uploading…'
                            : `Upload ${pending.length} file${pending.length === 1 ? '' : 's'}`}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <div>
                <Card>
                  <h2 className="text-lg font-semibold text-slate-900">Status timeline</h2>
                  <AsyncSection
                    loading={timeline.loading}
                    error={timeline.error}
                    data={timeline.data}
                    skeleton={<Skeleton className="mt-4 h-40 w-full" />}
                  >
                    {(entries) => <CaseTimeline entries={entries} />}
                  </AsyncSection>
                </Card>
              </div>
            </div>
          </>
        )}
      </AsyncSection>
    </div>
  );
}
