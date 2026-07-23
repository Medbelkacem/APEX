import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SoftDeleteDocument, applySoftDelete, baseSchemaOptions } from '../base.schema';
import { User } from './user.entity';

/** Profile data specific to a dentist user. 1-to-1 with User. */
@Schema(baseSchemaOptions('dentists'))
export class Dentist extends SoftDeleteDocument {
  @Prop({ type: String, ref: 'User', required: true, unique: true })
  userId: string;

  @Prop({ type: String, default: null })
  clinicName: string | null;

  @Prop({ type: String, default: null })
  clinicAddress: string | null;

  @Prop({ type: String, default: null })
  billingAddress: string | null;

  /** Pricing tier — optional, referenced by PricingRule.dentistTier. */
  @Prop({ type: String, default: null })
  tier: string | null;

  /** Internal, lab-only notes. */
  @Prop({ type: String, default: null })
  notes: string | null;

  // Populated virtuals — declared for typing only.
  declare user?: User;
  declare cases?: import('./case.entity').DentalCase[];
  declare invoices?: import('./invoice.entity').Invoice[];
  declare statements?: import('./monthly-statement.entity').MonthlyStatement[];
}

export type DentistDocument = HydratedDocument<Dentist>;
export const DentistSchema = SchemaFactory.createForClass(Dentist);
applySoftDelete(DentistSchema);

DentistSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});
DentistSchema.virtual('cases', { ref: 'DentalCase', localField: '_id', foreignField: 'dentistId' });
DentistSchema.virtual('invoices', { ref: 'Invoice', localField: '_id', foreignField: 'dentistId' });
DentistSchema.virtual('statements', {
  ref: 'MonthlyStatement',
  localField: '_id',
  foreignField: 'dentistId',
});
