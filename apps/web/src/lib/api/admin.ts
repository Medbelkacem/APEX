import { API_BASE, api } from './client';
import { toQueryString } from './cases';
import type { DentistWithUser, Paginated } from './types';
import type { PricingRule, User, UserRole, UserStatus } from '@dental/shared-types';

// ── Dentists ───────────────────────────────────────────────────────────────

export interface DentistInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  clinicName?: string | null;
  clinicAddress?: string | null;
  billingAddress?: string | null;
  tier?: string | null;
  notes?: string | null;
}

export const dentistsApi = {
  list: (query: { status?: string; search?: string; page?: number; limit?: number } = {}) =>
    api.get<Paginated<DentistWithUser>>(`/dentists${toQueryString(query)}`),
  detail: (id: string) => api.get<DentistWithUser>(`/dentists/${id}`),
  create: (input: DentistInput) => api.post<DentistWithUser>('/dentists', input),
  update: (id: string, input: Partial<DentistInput>) =>
    api.patch<DentistWithUser>(`/dentists/${id}`, input),
  disable: (id: string) => api.post<DentistWithUser>(`/dentists/${id}/disable`),
  enable: (id: string) => api.post<DentistWithUser>(`/dentists/${id}/enable`),
  resetPassword: (id: string) => api.post<{ success: boolean }>(`/dentists/${id}/reset-password`),
};

// ── Pricing ────────────────────────────────────────────────────────────────

export interface PricingRuleWithType extends PricingRule {
  caseType?: { id: string; name: string };
}

export const pricingApi = {
  list: (query: { caseTypeId?: string; includeInactive?: boolean; page?: number; limit?: number } = {}) =>
    api.get<Paginated<PricingRuleWithType>>(`/pricing${toQueryString(query)}`),
  create: (input: {
    caseTypeId: string;
    price: string;
    dentistTier?: string | null;
    material?: string | null;
    effectiveFrom?: string;
  }) => api.post<PricingRuleWithType>('/pricing', input),
  update: (id: string, input: Partial<{ price: string; dentistTier: string | null; material: string | null; isActive: boolean }>) =>
    api.patch<PricingRuleWithType>(`/pricing/${id}`, input),
  remove: (id: string) => api.del<{ success: boolean }>(`/pricing/${id}`),
  quote: (input: { caseTypeId: string; material?: string | null; dentistTier?: string | null }) =>
    api.post<{ price: string; currency: string; basis: string }>('/pricing/quote', input),
};

// ── Staff accounts ─────────────────────────────────────────────────────────

export const usersApi = {
  list: (query: { role?: UserRole; status?: UserStatus; search?: string; page?: number; limit?: number } = {}) =>
    api.get<Paginated<User>>(`/users${toQueryString(query)}`),
  create: (input: { email: string; firstName: string; lastName: string; role: UserRole; phone?: string | null }) =>
    api.post<User>('/users', input),
  update: (id: string, input: Partial<{ firstName: string; lastName: string; phone: string | null }>) =>
    api.patch<User>(`/users/${id}`, input),
  disable: (id: string) => api.post<User>(`/users/${id}/disable`),
  enable: (id: string) => api.post<User>(`/users/${id}/enable`),
  resetPassword: (id: string) => api.post<{ success: boolean }>(`/users/${id}/reset-password`),
};

// ── Statistics ─────────────────────────────────────────────────────────────

export interface AdminKpis {
  casesToday: number;
  casesThisWeek: number;
  casesThisMonth: number;
  activeCases: number;
  activeDentists: number;
  revenueThisMonth: string;
  outstandingTotal: string;
  avgTurnaroundDays: number | null;
}

export interface TimeSeriesPoint {
  period: string;
  value: number;
}

export interface DistributionSlice {
  label: string;
  value: number;
  color?: string;
}

export interface StatisticsOverview {
  range: { from: string; to: string };
  kpis: AdminKpis;
  casesOverTime: TimeSeriesPoint[];
  revenueOverTime: TimeSeriesPoint[];
  caseTypes: DistributionSlice[];
  statuses: DistributionSlice[];
  activity: Array<{ id: string; reference: string; dentistName: string; status: string; at: string }>;
}

export type ReportName = 'dentist-ranking' | 'revenue-by-case-type' | 'turnaround';

export const statisticsApi = {
  overview: (query: { from?: string; to?: string; granularity?: 'day' | 'month' } = {}) =>
    api.get<StatisticsOverview>(`/statistics/overview${toQueryString(query)}`),
  report: <T>(report: ReportName, query: { from?: string; to?: string } = {}) =>
    api.get<{ range: { from: string; to: string }; rows: T[] }>(
      `/statistics/reports${toQueryString({ report, ...query })}`,
    ),
  exportUrl: (report: ReportName, query: { from?: string; to?: string } = {}) =>
    `${API_BASE}/api/statistics/reports/export${toQueryString({ report, ...query })}`,
};

// ── Platform settings ──────────────────────────────────────────────────────

export interface PlatformSettingRow {
  key: string;
  value: string | null;
  isSecret: boolean;
  isSet: boolean;
  updatedAt: string | null;
}

export const settingsApi = {
  list: () => api.get<PlatformSettingRow[]>('/settings'),
  update: (settings: Array<{ key: string; value: string | null }>) =>
    api.put<PlatformSettingRow[]>('/settings', { settings }),
};

export interface AuditLogRow {
  id: string;
  createdAt: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
}

export const auditApi = {
  list: (query: { action?: string; entityType?: string; page?: number; limit?: number } = {}) =>
    api.get<Paginated<AuditLogRow>>(`/audit-logs${toQueryString(query)}`),
};
