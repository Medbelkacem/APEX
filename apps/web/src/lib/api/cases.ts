import { API_BASE, ApiError, api, csrfToken } from './client';
import type {
  CaseFileWithUploader,
  CaseSummary,
  CaseTimelineEntry,
  CaseWithRelations,
  Paginated,
} from './types';

export interface CaseListQuery {
  status?: string;
  caseTypeId?: string;
  dentistId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  bucket?: 'all' | 'active' | 'completed';
  sort?: 'submittedAt' | 'deadline' | 'reference';
  order?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export interface CreateCaseInput {
  caseTypeId: string;
  patientReference: string;
  toothRegion?: string | null;
  material?: string | null;
  shade?: string | null;
  deadline?: string | null;
  clinicalNotes?: string | null;
  dentistId?: string;
}

/** Drop empty values so blank filter inputs don't become `?search=`. */
export function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const casesApi = {
  list: (query: CaseListQuery = {}) =>
    api.get<Paginated<CaseWithRelations>>(`/cases${toQueryString(query)}`),
  summary: () => api.get<CaseSummary>('/cases/summary'),
  recent: (take = 5) => api.get<CaseWithRelations[]>(`/cases/recent?take=${take}`),
  detail: (id: string) => api.get<CaseWithRelations>(`/cases/${id}`),
  timeline: (id: string) => api.get<CaseTimelineEntry[]>(`/cases/${id}/timeline`),
  create: (input: CreateCaseInput) => api.post<CaseWithRelations>('/cases', input),
  update: (id: string, input: Partial<CreateCaseInput>) =>
    api.patch<CaseWithRelations>(`/cases/${id}`, input),
  changeStatus: (id: string, caseStatusId: string, note?: string) =>
    api.patch<CaseWithRelations>(`/cases/${id}/status`, { caseStatusId, note }),
  reassign: (id: string, dentistId: string, note?: string) =>
    api.post<CaseWithRelations>(`/cases/${id}/reassign`, { dentistId, note }),

  files: (id: string) => api.get<CaseFileWithUploader[]>(`/cases/${id}/files`),
  removeFile: (id: string, fileId: string) =>
    api.del<{ success: boolean }>(`/cases/${id}/files/${fileId}`),

  /** Direct link for a browser download — the cookie authenticates the request. */
  fileUrl: (id: string, fileId: string) => `${API_BASE}/api/cases/${id}/files/${fileId}`,
};

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

interface PresignedTarget {
  path: string;
  filename: string;
  uploadUrl: string;
  mimeType: string;
}

/** PUT one file straight to storage (B2/S3), reporting progress as it goes. */
function putDirect(target: PresignedTarget, file: File, onLoaded?: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', target.uploadUrl);
    // Must match exactly what the presigned URL's signature was computed
    // over — any other Content-Type fails the upload with a signature error.
    xhr.setRequestHeader('Content-Type', target.mimeType);
    xhr.upload.onprogress = (event) => onLoaded?.(event.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`"${target.filename}" failed to upload (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error(`Network error uploading "${target.filename}"`));
    xhr.send(file);
  });
}

/**
 * Upload the old way — the file bodies pass through the API itself. Kept as
 * the local-dev path (no B2 configured there) and as the fallback for a
 * deployment with no S3-compatible storage driver.
 */
function uploadViaApi(
  caseId: string,
  files: File[],
  options: { fileType?: string; onProgress?: (p: UploadProgress) => void },
): Promise<CaseFileWithUploader[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    if (options.fileType) form.append('fileType', options.fileType);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/cases/${caseId}/files`);
    xhr.withCredentials = true;
    // Mirror the CSRF double-submit that the JSON `request()` wrapper performs:
    // the guard rejects any state-changing call that carries the csrf cookie
    // without echoing it in this header, so multipart uploads need it too.
    const csrf = csrfToken();
    if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !options.onProgress) return;
      options.onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      });
    };

    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as CaseFileWithUploader[]);
        return;
      }
      const message =
        body && typeof body === 'object' && 'message' in body
          ? String((body as { message: unknown }).message)
          : `Upload failed (${xhr.status})`;
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}

/**
 * Upload case files directly to storage via a presigned URL, so a 40 MB STL
 * scan never has to pass through — and count against the body-size ceiling
 * of — the API itself. Falls back to routing the bytes through the API when
 * this deployment has no S3-compatible storage driver configured (local dev).
 */
export async function uploadCaseFiles(
  caseId: string,
  files: File[],
  options: { fileType?: string; onProgress?: (p: UploadProgress) => void } = {},
): Promise<CaseFileWithUploader[]> {
  let targets: PresignedTarget[];
  try {
    targets = await api.post<PresignedTarget[]>(`/cases/${caseId}/files/presign`, {
      files: files.map((f) => ({ filename: f.name, sizeBytes: f.size })),
      fileType: options.fileType,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) {
      return uploadViaApi(caseId, files, options);
    }
    throw err;
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const loadedByIndex = new Array<number>(files.length).fill(0);
  const reportProgress = () => {
    if (!options.onProgress) return;
    const loaded = loadedByIndex.reduce((sum, n) => sum + n, 0);
    options.onProgress({
      loaded,
      total: totalBytes,
      percent: totalBytes ? Math.round((loaded / totalBytes) * 100) : 0,
    });
  };

  await Promise.all(
    targets.map((target, i) =>
      putDirect(target, files[i], (loaded) => {
        loadedByIndex[i] = loaded;
        reportProgress();
      }),
    ),
  );

  return api.post<CaseFileWithUploader[]>(`/cases/${caseId}/files/finalize`, {
    files: targets.map((t) => ({ path: t.path, filename: t.filename })),
    fileType: options.fileType,
  });
}
