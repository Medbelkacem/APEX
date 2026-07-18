import type { UserStatus } from '@dental/shared-types';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/** Badge tone per account status, shared by the dentist and staff admin screens. */
export const USER_STATUS_TONES: Record<UserStatus | string, Tone> = {
  active: 'success',
  disabled: 'danger',
  invited: 'warning',
};
