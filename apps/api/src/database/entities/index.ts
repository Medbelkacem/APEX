import { User } from './user.entity';
import { RefreshToken } from './refresh-token.entity';
import { Dentist } from './dentist.entity';
import { CaseType } from './case-type.entity';
import { CaseStatus } from './case-status.entity';
import { DentalCase } from './case.entity';
import { CaseStatusHistory } from './case-status-history.entity';
import { CaseFile } from './case-file.entity';
import { PricingRule } from './pricing-rule.entity';
import { Invoice } from './invoice.entity';
import { InvoiceLineItem } from './invoice-line-item.entity';
import { MonthlyStatement } from './monthly-statement.entity';
import { NotificationEntity } from './notification.entity';
import { ContactMessage } from './contact-message.entity';
import { AuditLog } from './audit-log.entity';
import { PlatformSetting } from './platform-setting.entity';

export {
  User,
  RefreshToken,
  Dentist,
  CaseType,
  CaseStatus,
  DentalCase,
  CaseStatusHistory,
  CaseFile,
  PricingRule,
  Invoice,
  InvoiceLineItem,
  MonthlyStatement,
  NotificationEntity,
  ContactMessage,
  AuditLog,
  PlatformSetting,
};

/** All entities, consumed by TypeORM config and the CLI data-source. */
export const entities = [
  User,
  RefreshToken,
  Dentist,
  CaseType,
  CaseStatus,
  DentalCase,
  CaseStatusHistory,
  CaseFile,
  PricingRule,
  Invoice,
  InvoiceLineItem,
  MonthlyStatement,
  NotificationEntity,
  ContactMessage,
  AuditLog,
  PlatformSetting,
];
