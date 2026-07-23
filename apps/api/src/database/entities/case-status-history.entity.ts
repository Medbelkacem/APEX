import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseDocument, baseSchemaOptions } from '../base.schema';
import { DentalCase } from './case.entity';
import { CaseStatus } from './case-status.entity';
import { User } from './user.entity';

/** Append-only log of a case's status transitions. */
@Schema(baseSchemaOptions('case_status_history'))
export class CaseStatusHistory extends BaseDocument {
  @Prop({ type: String, ref: 'DentalCase', required: true })
  caseId: string;

  @Prop({ type: String, ref: 'CaseStatus', required: true })
  caseStatusId: string;

  @Prop({ type: String, ref: 'User', default: null })
  changedByUserId: string | null;

  @Prop({ type: String, default: null })
  note: string | null;

  declare case?: DentalCase;
  declare caseStatus?: CaseStatus;
  declare changedByUser?: User | null;
}

export type CaseStatusHistoryDocument = HydratedDocument<CaseStatusHistory>;
export const CaseStatusHistorySchema = SchemaFactory.createForClass(CaseStatusHistory);

CaseStatusHistorySchema.virtual('case', {
  ref: 'DentalCase',
  localField: 'caseId',
  foreignField: '_id',
  justOne: true,
});
CaseStatusHistorySchema.virtual('caseStatus', {
  ref: 'CaseStatus',
  localField: 'caseStatusId',
  foreignField: '_id',
  justOne: true,
});
CaseStatusHistorySchema.virtual('changedByUser', {
  ref: 'User',
  localField: 'changedByUserId',
  foreignField: '_id',
  justOne: true,
});
