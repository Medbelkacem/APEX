'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button, buttonClasses } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { FieldError, Input, Label, Textarea } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/data-states';
import { FileDropzone, UploadProgressBar } from '@/components/forms/file-dropzone';
import { useApi } from '@/lib/hooks/use-api';
import { catalogApi } from '@/lib/api/catalog';
import { casesApi, uploadCaseFiles } from '@/lib/api/cases';
import { formatBytes } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const STEPS = ['Case type', 'Details', 'Scan files', 'Notes', 'Review'] as const;

interface Draft {
  caseTypeId: string;
  patientReference: string;
  toothRegion: string;
  material: string;
  shade: string;
  deadline: string;
  clinicalNotes: string;
}

const EMPTY: Draft = {
  caseTypeId: '',
  patientReference: '',
  toothRegion: '',
  material: '',
  shade: '',
  deadline: '',
  clinicalNotes: '',
};

export default function NewCasePage() {
  const router = useRouter();
  const caseTypes = useApi(() => catalogApi.caseTypes(), []);

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string>();
  const [created, setCreated] = useState<{ id: string; reference: string } | null>(null);
  // Remembers a case that was created but whose file upload then failed, so a
  // retry re-attempts only the upload instead of filing a second case.
  const createdCaseRef = useRef<{ id: string; reference: string } | null>(null);

  const set = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }));

  /** Validate only the fields owned by the current step. */
  function validateStep(index: number): boolean {
    const next: Partial<Record<keyof Draft, string>> = {};
    if (index === 0 && !draft.caseTypeId) next.caseTypeId = 'Select a case type to continue';
    if (index === 1) {
      if (!draft.patientReference.trim()) {
        next.patientReference = 'A patient reference is required';
      }
      if (draft.deadline) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Parse the YYYY-MM-DD value as local midnight, not UTC — `new Date(str)`
        // reads a bare date as UTC, which for negative offsets makes today's date
        // compare as earlier than local midnight and wrongly reads as "in the past".
        if (new Date(`${draft.deadline}T00:00:00`) < today) {
          next.deadline = 'The deadline cannot be in the past';
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    // Re-check every gated step in case the user jumped back and cleared a field.
    if (!validateStep(0)) return setStep(0);
    if (!validateStep(1)) return setStep(1);

    setSubmitting(true);
    setSubmitError(undefined);
    try {
      // Create the case at most once. If an earlier attempt created it but the
      // upload failed, reuse it rather than submitting a duplicate case.
      if (!createdCaseRef.current) {
        const entity = await casesApi.create({
          caseTypeId: draft.caseTypeId,
          patientReference: draft.patientReference.trim(),
          toothRegion: draft.toothRegion.trim() || null,
          material: draft.material.trim() || null,
          shade: draft.shade.trim() || null,
          deadline: draft.deadline || null,
          clinicalNotes: draft.clinicalNotes.trim() || null,
        });
        createdCaseRef.current = { id: entity.id, reference: entity.reference };
      }
      const entity = createdCaseRef.current;

      if (files.length) {
        setUploadPercent(0);
        await uploadCaseFiles(entity.id, files, {
          onProgress: (p) => setUploadPercent(p.percent),
        });
      }
      setCreated(entity);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit the case');
    } finally {
      setSubmitting(false);
      setUploadPercent(null);
    }
  }

  const selectedType = caseTypes.data?.find((t) => t.id === draft.caseTypeId);

  // ── Confirmation ────────────────────────────────────────────────────────
  if (created) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
            ✓
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Case submitted</h1>
          <p className="mt-2 text-sm text-slate-500">
            The laboratory has been notified and will begin review shortly.
          </p>
          <p className="mt-6 text-sm text-slate-500">Your case reference</p>
          <p className="text-2xl font-bold tracking-tight text-brand-700">{created.reference}</p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/cases/${created.id}`} className={buttonClasses('primary', 'md')}>
              View case
            </Link>
            <Link href="/cases" className={buttonClasses('outline', 'md')}>
              All cases
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                setCreated(null);
                createdCaseRef.current = null;
                setDraft(EMPTY);
                setFiles([]);
                setStep(0);
              }}
            >
              Submit another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Submit a new case</h1>
        <p className="mt-1 text-sm text-slate-500">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>
      </div>

      {/* Step indicator */}
      <ol className="flex flex-wrap gap-2" aria-label="Progress">
        {STEPS.map((label, index) => {
          const state = index === step ? 'current' : index < step ? 'done' : 'todo';
          return (
            // Squeezing five steps onto one phone row leaves ~2rem of text;
            // a basis instead wraps them into readable rows.
            <li key={label} className="min-w-[7rem] flex-[1_1_7rem]">
              <button
                type="button"
                // Only allow jumping back to a step already completed.
                disabled={index > step}
                onClick={() => setStep(index)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors',
                  state === 'current' && 'border-brand-500 bg-brand-50 text-brand-800',
                  state === 'done' && 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  state === 'todo' &&
                    'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400',
                )}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span className="block text-[0.65rem] uppercase tracking-wide opacity-70">
                  Step {index + 1}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      <Card>
        {submitError && (
          <div className="mb-5">
            <Alert tone="error">{submitError}</Alert>
          </div>
        )}

        {/* Step 1 — case type */}
        {step === 0 && (
          <fieldset>
            <legend className="text-lg font-semibold text-slate-900">What are we making?</legend>
            <p className="mt-1 text-sm text-slate-500">
              Choose the restoration type for this case.
            </p>

            {caseTypes.loading && (
              <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                <Spinner /> Loading case types…
              </p>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {caseTypes.data?.map((type) => (
                <label
                  key={type.id}
                  className={cn(
                    'cursor-pointer rounded-xl border p-4 transition-colors',
                    draft.caseTypeId === type.id
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <input
                    type="radio"
                    name="caseType"
                    className="sr-only"
                    checked={draft.caseTypeId === type.id}
                    onChange={() => set({ caseTypeId: type.id })}
                  />
                  <span className="block font-semibold text-slate-900">{type.name}</span>
                  {type.description && (
                    <span className="mt-1 block text-sm text-slate-500">{type.description}</span>
                  )}
                </label>
              ))}
            </div>
            <FieldError>{errors.caseTypeId}</FieldError>
          </fieldset>
        )}

        {/* Step 2 — details */}
        {step === 1 && (
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-slate-900">Case details</legend>
            <p className="-mt-1 text-sm text-slate-500">
              Use an anonymised patient reference — never a full patient name.
            </p>

            <div>
              <Label htmlFor="patientReference">Patient reference *</Label>
              <Input
                id="patientReference"
                value={draft.patientReference}
                onChange={(e) => set({ patientReference: e.target.value })}
                placeholder="e.g. PT-2026-014"
              />
              <FieldError>{errors.patientReference}</FieldError>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="toothRegion">Tooth / region</Label>
                <Input
                  id="toothRegion"
                  value={draft.toothRegion}
                  onChange={(e) => set({ toothRegion: e.target.value })}
                  placeholder="e.g. UR6"
                />
              </div>
              <div>
                <Label htmlFor="material">Material preference</Label>
                <Input
                  id="material"
                  value={draft.material}
                  onChange={(e) => set({ material: e.target.value })}
                  placeholder="e.g. Zirconia"
                />
              </div>
              <div>
                <Label htmlFor="shade">Shade</Label>
                <Input
                  id="shade"
                  value={draft.shade}
                  onChange={(e) => set({ shade: e.target.value })}
                  placeholder="e.g. A2"
                />
              </div>
              <div>
                <Label htmlFor="deadline">Requested deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={draft.deadline}
                  onChange={(e) => set({ deadline: e.target.value })}
                />
                <FieldError>{errors.deadline}</FieldError>
              </div>
            </div>
          </fieldset>
        )}

        {/* Step 3 — files */}
        {step === 2 && (
          <fieldset>
            <legend className="text-lg font-semibold text-slate-900">Scan files</legend>
            <p className="mt-1 text-sm text-slate-500">
              Attach STL scans and any supporting photos or documents. You can also add files later
              from the case page.
            </p>
            <div className="mt-5">
              <FileDropzone files={files} onChange={setFiles} disabled={submitting} />
            </div>
          </fieldset>
        )}

        {/* Step 4 — notes */}
        {step === 3 && (
          <fieldset>
            <legend className="text-lg font-semibold text-slate-900">Clinical notes</legend>
            <p className="mt-1 text-sm text-slate-500">
              Anything the technician should know — occlusion, contacts, margins, preferences.
            </p>
            <div className="mt-5">
              <Label htmlFor="clinicalNotes">Notes (optional)</Label>
              <Textarea
                id="clinicalNotes"
                value={draft.clinicalNotes}
                onChange={(e) => set({ clinicalNotes: e.target.value })}
                placeholder="e.g. Light contacts, heavy occlusion on the distal margin…"
              />
            </div>
          </fieldset>
        )}

        {/* Step 5 — review */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Review and confirm</h2>
            <p className="mt-1 text-sm text-slate-500">
              Check everything below, then submit the case to the laboratory.
            </p>

            <dl className="mt-6 divide-y divide-slate-100 text-sm">
              {[
                ['Case type', selectedType?.name ?? '—'],
                ['Patient reference', draft.patientReference || '—'],
                ['Tooth / region', draft.toothRegion || '—'],
                ['Material', draft.material || '—'],
                ['Shade', draft.shade || '—'],
                ['Deadline', draft.deadline || 'No deadline set'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right font-medium text-slate-900">{value}</dd>
                </div>
              ))}
              <div className="py-2.5">
                <dt className="text-slate-500">Clinical notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-slate-800">
                  {draft.clinicalNotes || '—'}
                </dd>
              </div>
              <div className="py-2.5">
                <dt className="text-slate-500">Files ({files.length})</dt>
                <dd className="mt-1 space-y-1">
                  {files.length === 0 && <span className="text-slate-800">No files attached</span>}
                  {files.map((file) => (
                    <div key={file.name} className="flex justify-between gap-4">
                      <span className="truncate text-slate-800">{file.name}</span>
                      <span className="shrink-0 text-slate-500">{formatBytes(file.size)}</span>
                    </div>
                  ))}
                </dd>
              </div>
            </dl>

            {uploadPercent !== null && <UploadProgressBar percent={uploadPercent} />}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0 || submitting}
          >
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext}>
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting && <Spinner className="mr-2" />}
              {submitting ? 'Submitting…' : 'Submit case'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
