import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { InvoiceStatus } from '@dental/shared-types';
import { SoftDeleteDocument, applySoftDelete, baseSchemaOptions } from '../base.schema';
import { Dentist } from './dentist.entity';
import { DentalCase } from './case.entity';

/** An invoice issued to a dentist, per case or as a batch. Amounts are decimal strings. */
@Schema(baseSchemaOptions('invoices'))
export class Invoice extends SoftDeleteDocument {
  /** Sequential, e.g. INV-2026-0001. */
  @Prop({ type: String, required: true, unique: true })
  number: string;

  @Prop({ type: String, ref: 'Dentist', required: true })
  dentistId: string;

  /** null for batch invoices spanning multiple cases. */
  @Prop({ type: String, ref: 'DentalCase', default: null })
  caseId: string | null;

  /** ISO date (YYYY-MM-DD). */
  @Prop({ type: String, required: true })
  issueDate: string;

  @Prop({ type: String, default: null })
  dueDate: string | null;

  @Prop({ type: String, default: '0' })
  subtotal: string;

  @Prop({ type: String, default: '0' })
  tax: string;

  @Prop({ type: String, default: '0' })
  total: string;

  @Prop({ type: String, default: 'USD' })
  currency: string;

  @Prop({ type: String, enum: Object.values(InvoiceStatus), default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  /** Cached PDF path on the storage backend. */
  @Prop({ type: String, default: null })
  pdfPath: string | null;

  @Prop({ type: String, default: null })
  stripePaymentIntentId: string | null;

  @Prop({ type: Date, default: null })
  paidAt: Date | null;

  declare dentist?: Dentist;
  declare case?: DentalCase | null;
  declare lineItems?: import('./invoice-line-item.entity').InvoiceLineItem[];
}

export type InvoiceDocument = HydratedDocument<Invoice>;
export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
applySoftDelete(InvoiceSchema);

InvoiceSchema.virtual('dentist', {
  ref: 'Dentist',
  localField: 'dentistId',
  foreignField: '_id',
  justOne: true,
});
InvoiceSchema.virtual('case', {
  ref: 'DentalCase',
  localField: 'caseId',
  foreignField: '_id',
  justOne: true,
});
InvoiceSchema.virtual('lineItems', {
  ref: 'InvoiceLineItem',
  localField: '_id',
  foreignField: 'invoiceId',
});
