import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseDocument, baseSchemaOptions } from '../base.schema';

/** A configurable workflow status a case can move through. */
@Schema(baseSchemaOptions('case_statuses'))
export class CaseStatus extends BaseDocument {
  @Prop({ type: String, required: true })
  label: string;

  @Prop({ type: String, required: true, unique: true })
  slug: string;

  /** Hex color for UI badges, e.g. #2563eb. */
  @Prop({ type: String, default: '#64748b' })
  color: string;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  /** Terminal statuses end the workflow (e.g. Completed, Cancelled). */
  @Prop({ type: Boolean, default: false })
  isTerminal: boolean;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  declare cases?: import('./case.entity').DentalCase[];
}

export type CaseStatusDocument = HydratedDocument<CaseStatus>;
export const CaseStatusSchema = SchemaFactory.createForClass(CaseStatus);

CaseStatusSchema.virtual('cases', {
  ref: 'DentalCase',
  localField: '_id',
  foreignField: 'currentStatusId',
});
