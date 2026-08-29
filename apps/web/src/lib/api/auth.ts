import type { AuthenticatedUser } from '@dental/shared-types';
import { api } from './client';

export interface LoginInput {
  email: string;
  password: string;
}

export interface PublicUserResponse extends AuthenticatedUser {
  phone: string | null;
  status: string;
  fullName: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  /** Required by the API — self-registration must identify the practice. */
  clinicName: string;
  clinicAddress: string;
}

export const authApi = {
  login: (input: LoginInput) => api.post<{ user: PublicUserResponse }>('/auth/login', input),
  /**
   * Always resolves the same way whether or not the address was already taken —
   * the API will not confirm who is registered, so there is no "email in use"
   * error to surface here.
   */
  register: (input: RegisterInput) => api.post<{ message: string }>('/auth/register', input),
  verifyEmail: (input: { userId: string; token: string }) =>
    api.post<{ status: string; message: string }>('/auth/verify-email', input),
  logout: () => api.post<{ success: boolean }>('/auth/logout'),
  me: () => api.get<PublicUserResponse>('/auth/me'),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (input: { userId: string; token: string; password: string }) =>
    api.post<{ success: boolean }>('/auth/reset-password', input),
  setupPassword: (input: { userId: string; token: string; password: string }) =>
    api.post<{ success: boolean }>('/auth/setup-password', input),
  updateProfile: (input: { firstName?: string; lastName?: string; phone?: string | null }) =>
    api.patch<PublicUserResponse>('/auth/me', input),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    api.post<{ success: boolean }>('/auth/change-password', input),
};

export const contactApi = {
  submit: (input: { name: string; email: string; subject: string; message: string }) =>
    api.post<{ message: string }>('/contact', input),
};
