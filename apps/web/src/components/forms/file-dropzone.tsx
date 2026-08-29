'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatBytes } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';

/** Mirrors the server's allow-list so users get instant feedback. */
export const ACCEPTED_EXTENSIONS = ['.stl', '.png', '.jpg', '.jpeg', '.pdf'] as const;

const SIZE_LIMITS: Record<string, number> = {
  '.stl': 100 * 1024 * 1024,
  '.png': 10 * 1024 * 1024,
  '.jpg': 10 * 1024 * 1024,
  '.jpeg': 10 * 1024 * 1024,
  '.pdf': 25 * 1024 * 1024,
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

/**
 * Client-side pre-check. Purely a UX affordance — the server re-validates every
 * upload by sniffing magic bytes, which is the check that actually matters.
 */
export function validateFile(file: File): string | null {
  const ext = extensionOf(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
    return `${file.name}: ${ext || 'files without an extension'} is not accepted`;
  }
  if (file.size === 0) return `${file.name} is empty`;
  const limit = SIZE_LIMITS[ext];
  if (limit && file.size > limit) {
    return `${file.name} is ${formatBytes(file.size)} — the limit for ${ext} is ${formatBytes(limit)}`;
  }
  return null;
}

export function FileDropzone({
  files,
  onChange,
  disabled,
  hint = 'STL scans, images (PNG/JPG), and PDF documents',
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming?.length) return;
      const accepted: File[] = [];
      const rejected: string[] = [];

      for (const file of Array.from(incoming)) {
        const problem = validateFile(file);
        if (problem) {
          rejected.push(problem);
          continue;
        }
        // De-duplicate by name+size so a double drop doesn't upload twice.
        const duplicate = files.some((f) => f.name === file.name && f.size === file.size);
        if (!duplicate) accepted.push(file);
      }

      setErrors(rejected);
      if (accepted.length) onChange([...files, ...accepted]);
    },
    [files, onChange],
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-8',
          dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50',
          disabled && 'opacity-60',
        )}
      >
        <p className="text-sm font-medium text-slate-700">
          Drag and drop files here, or{' '}
          <label
            htmlFor={inputId}
            className="cursor-pointer text-blue-700 underline underline-offset-2"
          >
            browse
          </label>
        </p>
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          multiple
          disabled={disabled}
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files);
            // Reset so re-selecting the same file still fires onChange.
            e.target.value = '';
          }}
        />
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1" role="alert">
          {errors.map((message) => (
            <li key={message} className="text-sm text-red-600">
              {message}
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                aria-label={`Remove ${file.name}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Determinate progress bar shown while an upload is in flight. */
export function UploadProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mt-4">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">Uploading… {percent}%</p>
    </div>
  );
}
