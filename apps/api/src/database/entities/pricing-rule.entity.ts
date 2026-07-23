import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SoftDeleteDocument, applySoftDelete, baseSchemaOptions } from '../base.schema';
import { CaseType } from './case-type.entity';

/** Price for a case type, optionally scoped to a dentist tier / material. */
@Schema(baseSchemaOptions('pricing_rules'))
export class PricingRule extends SoftDeleteDocument {
  @Prop({ type: String, ref: 'CaseType', required: true })
  caseTypeId: string;

  /** null = default price for the case type. */
  @Prop({ type: String, default: null })
  dentistTier: string | null;

  /** Optional surcharge scope by material. */
  @Prop({ type: String, default: null })
  material: string | null;

  @Prop({ type: String, required: true })
  price: string;

  @Prop({ type: String, default: 'USD' })
  currency: string;

  /** ISO date (YYYY-MM-DD). */
  @Prop({ type: String, required: true })
  effectiveFrom: string;

  @Prop({ type: String, default: null })
  effectiveTo: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  declare caseType?: CaseType;
}

export type PricingRuleDocument = HydratedDocument<PricingRule>;
export const PricingRuleSchema = SchemaFactory.createForClass(PricingRule);
applySoftDelete(PricingRuleSchema);

PricingRuleSchema.virtual('caseType', {
  ref: 'CaseType',
  localField: 'caseTypeId',
  foreignField: '_id',
  justOne: true,
});
