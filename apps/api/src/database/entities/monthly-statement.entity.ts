import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseDocument, baseSchemaOptions } from '../base.schema';
import { Dentist } from './dentist.entity';

/** A per-dentist, per-month statement aggregating invoices for the period. */
@Schema(baseSchemaOptions('monthly_statements'))
export class MonthlyStatement extends BaseDocument {
  @Prop({ type: String, ref: 'Dentist', required: true })
  dentistId: string;

  @Prop({ type: Number, required: true })
  periodYear: number;

  /** 1–12. */
  @Prop({ type: Number, required: true })
  periodMonth: number;

  @Prop({ type: String, default: '0' })
  openingBalance: string;

  @Prop({ type: String, default: '0' })
  closingBalance: string;

  @Prop({ type: String, default: '0' })
  totalInvoiced: string;

  @Prop({ type: String, default: '0' })
  totalPaid: string;

  @Prop({ type: String, default: null })
  pdfPath: string | null;

  @Prop({ type: Date, default: null })
  sentAt: Date | null;

  declare dentist?: Dentist;
}

export type MonthlyStatementDocument = HydratedDocument<MonthlyStatement>;
export const MonthlyStatementSchema = SchemaFactory.createForClass(MonthlyStatement);

MonthlyStatementSchema.index(
  { dentistId: 1, periodYear: 1, periodMonth: 1 },
  { unique: true },
);
MonthlyStatementSchema.virtual('dentist', {
  ref: 'Dentist',
  localField: 'dentistId',
  foreignField: '_id',
  justOne: true,
});
