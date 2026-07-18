import type { InvoiceStatus } from '@dental/shared-types';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/** Badge tone per invoice status, shared by the portal and admin dashboard. */
export const INVOICE_TONES: Record<InvoiceStatus | string, Tone> = {
  draft: 'neutral',
  issued: 'warning',
  paid: 'success',
  cancelled: 'neutral',
  refunded: 'info',
};
