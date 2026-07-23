import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseDocument, baseSchemaOptions } from '../base.schema';
import { Invoice } from './invoice.entity';

/** A single line on an invoice. Amounts are decimal strings. */
@Schema(baseSchemaOptions('invoice_line_items'))
export class InvoiceLineItem extends BaseDocument {
  @Prop({ type: String, ref: 'Invoice', required: true })
  invoiceId: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: Number, default: 1 })
  quantity: number;

  @Prop({ type: String, required: true })
  unitPrice: string;

  @Prop({ type: String, required: true })
  total: string;

  declare invoice?: Invoice;
}

export type InvoiceLineItemDocument = HydratedDocument<InvoiceLineItem>;
export const InvoiceLineItemSchema = SchemaFactory.createForClass(InvoiceLineItem);

InvoiceLineItemSchema.virtual('invoice', {
  ref: 'Invoice',
  localField: 'invoiceId',
  foreignField: '_id',
  justOne: true,
});
