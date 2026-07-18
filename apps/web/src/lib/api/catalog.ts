import type { CaseStatus, CaseType } from '@dental/shared-types';
import { api } from './client';

export const catalogApi = {
  caseTypes: (includeInactive = false) =>
    api.get<CaseType[]>(`/catalog/case-types${includeInactive ? '?includeInactive=true' : ''}`),
  createCaseType: (input: { name: string; description?: string | null; sortOrder?: number }) =>
    api.post<CaseType>('/catalog/case-types', input),
  updateCaseType: (id: string, input: Partial<CaseType>) =>
    api.patch<CaseType>(`/catalog/case-types/${id}`, input),
  removeCaseType: (id: string) =>
    api.del<{ deleted: boolean; deactivated: boolean }>(`/catalog/case-types/${id}`),

  statuses: (includeInactive = false) =>
    api.get<CaseStatus[]>(`/catalog/case-statuses${includeInactive ? '?includeInactive=true' : ''}`),
  createStatus: (input: { label: string; color?: string; isTerminal?: boolean }) =>
    api.post<CaseStatus>('/catalog/case-statuses', input),
  updateStatus: (id: string, input: Partial<CaseStatus>) =>
    api.patch<CaseStatus>(`/catalog/case-statuses/${id}`, input),
  reorderStatuses: (ids: string[]) => api.post<CaseStatus[]>('/catalog/case-statuses/reorder', { ids }),
  removeStatus: (id: string) => api.del<{ deactivated: boolean }>(`/catalog/case-statuses/${id}`),
};
