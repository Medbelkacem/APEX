import type {
  CaseFile,
  CaseStatus,
  CaseType,
  DentalCase,
  Dentist,
  Invoice,
  InvoiceLineItem,
  MonthlyStatement,
  NotificationRecord,
  User,
} from '@dental/shared-types';

/** Standard paginated envelope returned by every list endpoint. */
export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** A dentist joined with its owning user account, as the API serializes it. */
export interface DentistWithUser extends Dentist {
  user: User;
}

/** Case detail as returned with its relations eagerly joined. */
export interface CaseWithRelations extends DentalCase {
  caseType: CaseType;
  currentStatus: CaseStatus;
  dentist: DentistWithUser;
}

export interface CaseFileWithUploader extends CaseFile {
  uploadedByUser: User | null;
}

export interface CaseTimelineEntry {
  id: string;
  createdAt: string;
  note: string | null;
  caseStatus: CaseStatus;
  changedByUser: User | null;
}

export interface CaseSummary {
  total: number;
  active: number;
  completed: number;
  dueSoon: number;
}

export interface InvoiceWithRelations extends Invoice {
  dentist?: DentistWithUser;
  lineItems?: InvoiceLineItem[];
  case?: DentalCase | null;
}

export interface StatementWithDentist extends MonthlyStatement {
  dentist?: DentistWithUser;
}

/** The admin delivery log joins the recipient; the per-user feed does not. */
export interface NotificationWithUser extends NotificationRecord {
  user?: User;
}

export type { NotificationRecord };
