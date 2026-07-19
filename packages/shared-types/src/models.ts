import {
  CaseFileType,
  InvoiceStatus,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  UserRole,
  UserStatus,
} from './enums';

/** Fields present on every persisted record. */
export interface BaseModel {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface User extends BaseModel {
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: UserStatus;
  lastLoginAt: string | null;
  /**
   * When the address was confirmed. Null on accounts that predate email
   * verification, so it separates the two halves of `pending` and nothing else.
   */
  emailVerifiedAt: string | null;
}

export interface Dentist extends BaseModel {
  userId: string;
  clinicName: string | null;
  clinicAddress: string | null;
  billingAddress: string | null;
  tier: string | null;
  notes: string | null;
}

export interface CaseType extends BaseModel {
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface CaseStatus extends BaseModel {
  label: string;
  slug: string;
  color: string;
  sortOrder: number;
  isTerminal: boolean;
  isActive: boolean;
}

export interface DentalCase extends BaseModel {
  reference: string;
  dentistId: string;
  caseTypeId: string;
  patientReference: string;
  toothRegion: string | null;
  material: string | null;
  shade: string | null;
  deadline: string | null;
  clinicalNotes: string | null;
  currentStatusId: string;
  submittedAt: string;
  completedAt: string | null;
}

export interface CaseFile extends BaseModel {
  caseId: string;
  fileType: CaseFileType;
  originalFilename: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
}

export interface PricingRule extends BaseModel {
  caseTypeId: string;
  /** null = applies to every dentist tier. */
  dentistTier: string | null;
  /** null = applies to every material. */
  material: string | null;
  price: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

export interface Invoice extends BaseModel {
  number: string;
  dentistId: string;
  caseId: string | null;
  issueDate: string;
  dueDate: string | null;
  subtotal: string;
  tax: string;
  total: string;
  currency: string;
  status: InvoiceStatus;
  pdfPath: string | null;
  stripePaymentIntentId: string | null;
  paidAt: string | null;
}

export interface InvoiceLineItem extends BaseModel {
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

export interface MonthlyStatement extends BaseModel {
  dentistId: string;
  periodYear: number;
  periodMonth: number;
  openingBalance: string;
  closingBalance: string;
  totalInvoiced: string;
  totalPaid: string;
  pdfPath: string | null;
  sentAt: string | null;
}

export interface NotificationRecord extends BaseModel {
  userId: string;
  type: NotificationType;
  subject: string;
  body: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  relatedCaseId: string | null;
  relatedInvoiceId: string | null;
  sentAt: string | null;
  readAt: string | null;
}

/** Shape of the authenticated principal returned by the API. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}
