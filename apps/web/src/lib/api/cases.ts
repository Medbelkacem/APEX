import { API_BASE, api } from './client';
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

/**
 * Upload case files with progress. Uses XMLHttpRequest rather than fetch
 * because fetch still cannot report request-body upload progress, and large
 * STL scans need a real progress bar.
 */
export function uploadCaseFiles(
  caseId: string,
  files: File[],
  options: { fileType?: string; onProgress?: (p: UploadProgress) => void } = {},
): Promise<CaseFileWithUploader[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    if (options.fileType) form.append('fileType', options.fileType);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/cases/${caseId}/files`);
    xhr.withCredentials = true;

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
