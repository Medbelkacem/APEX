import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SoftDeleteDocument, applySoftDelete, baseSchemaOptions } from '../base.schema';

/** Catalog of dental case types (Crown, Bridge, Implant, ...). */
@Schema(baseSchemaOptions('case_types'))
export class CaseType extends SoftDeleteDocument {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true, unique: true })
  slug: string;

  @Prop({ type: String, default: null })
  description: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  declare cases?: import('./case.entity').DentalCase[];
}

export type CaseTypeDocument = HydratedDocument<CaseType>;
export const CaseTypeSchema = SchemaFactory.createForClass(CaseType);
applySoftDelete(CaseTypeSchema);

CaseTypeSchema.virtual('cases', {
  ref: 'DentalCase',
  localField: '_id',
  foreignField: 'caseTypeId',
});
