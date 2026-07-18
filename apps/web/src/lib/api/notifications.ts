import { api } from './client';
import { toQueryString } from './cases';
import type { NotificationRecord, NotificationWithUser, Paginated } from './types';

export const notificationsApi = {
  list: (query: { unreadOnly?: boolean; page?: number; limit?: number } = {}) =>
    api.get<Paginated<NotificationRecord>>(`/notifications${toQueryString(query)}`),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.post<{ success: boolean }>(`/notifications/${id}/read`),
  markAllRead: () => api.post<{ updated: number }>('/notifications/read-all'),

  // Admin
  log: (query: { type?: string; page?: number; limit?: number } = {}) =>
    api.get<Paginated<NotificationWithUser>>(`/admin/notifications${toQueryString(query)}`),
  send: (input: { userId?: string; broadcast?: boolean; subject: string; message: string }) =>
    api.post<{ recipients: number }>('/admin/notifications/send', input),
};
