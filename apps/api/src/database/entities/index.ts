import { ModelDefinition } from '@nestjs/mongoose';

import { User, UserSchema } from './user.entity';
import { RefreshToken, RefreshTokenSchema } from './refresh-token.entity';
import { Dentist, DentistSchema } from './dentist.entity';
import { CaseType, CaseTypeSchema } from './case-type.entity';
import { CaseStatus, CaseStatusSchema } from './case-status.entity';
import { DentalCase, DentalCaseSchema } from './case.entity';
import { CaseStatusHistory, CaseStatusHistorySchema } from './case-status-history.entity';
import { CaseFile, CaseFileSchema } from './case-file.entity';
import { PricingRule, PricingRuleSchema } from './pricing-rule.entity';
import { Invoice, InvoiceSchema } from './invoice.entity';
import { InvoiceLineItem, InvoiceLineItemSchema } from './invoice-line-item.entity';
import { MonthlyStatement, MonthlyStatementSchema } from './monthly-statement.entity';
import { NotificationEntity, NotificationSchema } from './notification.entity';
import { ContactMessage, ContactMessageSchema } from './contact-message.entity';
import { AuditLog, AuditLogSchema } from './audit-log.entity';
import { PlatformSetting, PlatformSettingSchema } from './platform-setting.entity';
import { Counter, CounterSchema } from './counter.entity';

export * from './user.entity';
export * from './refresh-token.entity';
export * from './dentist.entity';
export * from './case-type.entity';
export * from './case-status.entity';
export * from './case.entity';
export * from './case-status-history.entity';
export * from './case-file.entity';
export * from './pricing-rule.entity';
export * from './invoice.entity';
export * from './invoice-line-item.entity';
export * from './monthly-statement.entity';
export * from './notification.entity';
export * from './contact-message.entity';
export * from './audit-log.entity';
export * from './platform-setting.entity';
export * from './counter.entity';

/**
 * Every model definition, consumed by the seeder/CLI connection. Modules
 * register only the subset they need via `MongooseModule.forFeature`.
 */
export const modelDefinitions: ModelDefinition[] = [
  { name: User.name, schema: UserSchema },
  { name: RefreshToken.name, schema: RefreshTokenSchema },
  { name: Dentist.name, schema: DentistSchema },
  { name: CaseType.name, schema: CaseTypeSchema },
  { name: CaseStatus.name, schema: CaseStatusSchema },
  { name: DentalCase.name, schema: DentalCaseSchema },
  { name: CaseStatusHistory.name, schema: CaseStatusHistorySchema },
  { name: CaseFile.name, schema: CaseFileSchema },
  { name: PricingRule.name, schema: PricingRuleSchema },
  { name: Invoice.name, schema: InvoiceSchema },
  { name: InvoiceLineItem.name, schema: InvoiceLineItemSchema },
  { name: MonthlyStatement.name, schema: MonthlyStatementSchema },
  { name: NotificationEntity.name, schema: NotificationSchema },
  { name: ContactMessage.name, schema: ContactMessageSchema },
  { name: AuditLog.name, schema: AuditLogSchema },
  { name: PlatformSetting.name, schema: PlatformSettingSchema },
  { name: Counter.name, schema: CounterSchema },
];
