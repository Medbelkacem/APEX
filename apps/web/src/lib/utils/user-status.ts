import type { UserStatus } from '@dental/shared-types';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/** Badge tone per account status, shared by the dentist and staff admin screens. */
export const USER_STATUS_TONES: Record<UserStatus | string, Tone> = {
  active: 'success',
  disabled: 'danger',
  invited: 'warning',
  pending: 'info',
};

/**
 * What a status means for someone reading the table. `pending` needs the most
 * explaining: it covers both halves of a self-registration, and the two want
 * different things from an admin — one is waiting on the applicant, the other
 * is waiting on the lab.
 */
export function userStatusLabel(status: string, emailVerified: boolean): string {
  if (status !== 'pending') return status;
  return emailVerified ? 'awaiting approval' : 'unconfirmed email';
}
