/**
 * Domain enums shared between the API (TypeORM entities, DTOs) and the web app.
 * Keep these values in sync with database columns and migrations.
 */

export enum UserRole {
  DENTIST = 'dentist',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  /** Created by an admin; awaiting first-login password setup. */
  INVITED = 'invited',
  /**
   * Self-registered and not yet cleared to sign in. `emailVerifiedAt`
   * distinguishes the two halves of this state: null means the address is still
   * unconfirmed, set means the lab has yet to approve the account.
   */
  PENDING = 'pending',
}

/** Categories of file attached to a case. */
export enum CaseFileType {
  STL = 'stl',
  IMAGE = 'image',
  DOCUMENT = 'document',
  LAB_OUTPUT = 'lab_output',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum NotificationType {
  DENTIST_INVITATION = 'dentist_invitation',
  PASSWORD_RESET = 'password_reset',
  CASE_SUBMITTED = 'case_submitted',
  CASE_STATUS_CHANGED = 'case_status_changed',
  INVOICE_ISSUED = 'invoice_issued',
  PAYMENT_RECEIVED = 'payment_received',
  STATEMENT_READY = 'statement_ready',
  ADMIN_BROADCAST = 'admin_broadcast',
}

export enum NotificationChannel {
  EMAIL = 'email',
  IN_APP = 'in_app',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  READ = 'read',
}

/** Convenience groupings used for route/UI guards. */
export const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
export const ALL_ROLES: UserRole[] = [UserRole.DENTIST, UserRole.ADMIN, UserRole.SUPER_ADMIN];
