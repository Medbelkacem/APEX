import { API_BASE, api } from './client';
import { toQueryString } from './cases';
import type { InvoiceWithRelations, Paginated, StatementWithDentist } from './types';

export interface InvoiceListQuery {
  status?: string;
  dentistId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface OutstandingBalance {
  total: string;
  currency: string;
  count: number;
}

export const invoicesApi = {
  list: (query: InvoiceListQuery = {}) =>
    api.get<Paginated<InvoiceWithRelations>>(`/invoices${toQueryString(query)}`),
  detail: (id: string) => api.get<InvoiceWithRelations>(`/invoices/${id}`),
  /** Total unpaid for the current dentist — powers the dashboard balance card. */
  outstanding: () => api.get<OutstandingBalance>('/invoices/outstanding'),
  pdfUrl: (id: string) => `${API_BASE}/api/invoices/${id}/pdf`,

  // Admin
  generateForCase: (caseId: string) =>
    api.post<InvoiceWithRelations>('/invoices/generate', { caseId }),
  /** `created` counts the cases rolled up; they land on ONE batch invoice. */
  generateBatch: (input: { dentistId: string; dateFrom?: string; dateTo?: string }) =>
    api.post<{ created: number; invoice: InvoiceWithRelations | null }>(
      '/invoices/generate-batch',
      input,
    ),
  issue: (id: string) => api.post<InvoiceWithRelations>(`/invoices/${id}/issue`),
  markPaid: (id: string, note?: string) =>
    api.post<InvoiceWithRelations>(`/invoices/${id}/mark-paid`, { note }),
  cancel: (id: string) => api.post<InvoiceWithRelations>(`/invoices/${id}/cancel`),
  refund: (id: string) => api.post<InvoiceWithRelations>(`/invoices/${id}/refund`),

  /** Start an online payment; returns the Stripe client secret for this invoice. */
  createPaymentIntent: (id: string) =>
    api.post<{ clientSecret: string; publishableKey: string; amount: string; currency: string }>(
      `/invoices/${id}/payment-intent`,
    ),
};

export const statementsApi = {
  list: (query: { dentistId?: string; year?: number; page?: number; limit?: number } = {}) =>
    api.get<Paginated<StatementWithDentist>>(`/statements${toQueryString(query)}`),
  detail: (id: string) => api.get<StatementWithDentist>(`/statements/${id}`),
  pdfUrl: (id: string) => `${API_BASE}/api/statements/${id}/pdf`,

  // Admin
  generate: (input: { dentistId: string; year: number; month: number }) =>
    api.post<StatementWithDentist>('/statements/generate', input),
  generateAll: (input: { year: number; month: number }) =>
    api.post<{ created: number }>('/statements/generate-all', input),
  send: (id: string) => api.post<{ success: boolean }>(`/statements/${id}/send`),
};
