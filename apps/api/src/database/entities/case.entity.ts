import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SoftDeleteDocument, applySoftDelete, baseSchemaOptions } from '../base.schema';
import { Dentist } from './dentist.entity';
import { CaseType } from './case-type.entity';
import { CaseStatus } from './case-status.entity';

/** A dental case submitted by a dentist. */
@Schema(baseSchemaOptions('cases'))
export class DentalCase extends SoftDeleteDocument {
  /** Human-readable reference, e.g. CASE-2026-0001. */
  @Prop({ type: String, required: true, unique: true })
  reference: string;

  @Prop({ type: String, ref: 'Dentist', required: true })
  dentistId: string;

  @Prop({ type: String, ref: 'CaseType', required: true })
  caseTypeId: string;

  /** Anonymized patient label — no PHI beyond what the workflow needs. */
  @Prop({ type: String, required: true })
  patientReference: string;

  @Prop({ type: String, default: null })
  toothRegion: string | null;

  @Prop({ type: String, default: null })
  material: string | null;

  @Prop({ type: String, default: null })
  shade: string | null;

  /** ISO date (YYYY-MM-DD). */
  @Prop({ type: String, default: null })
  deadline: string | null;

  @Prop({ type: String, default: null })
  clinicalNotes: string | null;

  @Prop({ type: String, ref: 'CaseStatus', required: true })
  currentStatusId: string;

  @Prop({ type: Date, default: () => new Date() })
  submittedAt: Date;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  // Populated virtuals — declared for typing only.
  declare dentist?: Dentist;
  declare caseType?: CaseType;
  declare currentStatus?: CaseStatus;
  declare files?: import('./case-file.entity').CaseFile[];
  declare statusHistory?: import('./case-status-history.entity').CaseStatusHistory[];
  declare invoices?: import('./invoice.entity').Invoice[];
}

export type DentalCaseDocument = HydratedDocument<DentalCase>;
export const DentalCaseSchema = SchemaFactory.createForClass(DentalCase);
applySoftDelete(DentalCaseSchema);

DentalCaseSchema.virtual('dentist', {
  ref: 'Dentist',
  localField: 'dentistId',
  foreignField: '_id',
  justOne: true,
});
DentalCaseSchema.virtual('caseType', {
  ref: 'CaseType',
  localField: 'caseTypeId',
  foreignField: '_id',
  justOne: true,
});
DentalCaseSchema.virtual('currentStatus', {
  ref: 'CaseStatus',
  localField: 'currentStatusId',
  foreignField: '_id',
  justOne: true,
});
DentalCaseSchema.virtual('files', { ref: 'CaseFile', localField: '_id', foreignField: 'caseId' });
DentalCaseSchema.virtual('statusHistory', {
  ref: 'CaseStatusHistory',
  localField: '_id',
  foreignField: 'caseId',
});
DentalCaseSchema.virtual('invoices', { ref: 'Invoice', localField: '_id', foreignField: 'caseId' });
