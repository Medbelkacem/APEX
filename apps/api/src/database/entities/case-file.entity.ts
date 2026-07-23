import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { CaseFileType } from '@dental/shared-types';
import { BaseDocument, baseSchemaOptions } from '../base.schema';
import { DentalCase } from './case.entity';
import { User } from './user.entity';

/** A file attached to a case — STL scan, image, document, or lab output. */
@Schema(baseSchemaOptions('case_files'))
export class CaseFile extends BaseDocument {
  @Prop({ type: String, ref: 'DentalCase', required: true })
  caseId: string;

  @Prop({ type: String, enum: Object.values(CaseFileType), required: true })
  fileType: CaseFileType;

  @Prop({ type: String, required: true })
  originalFilename: string;

  /** Relative path on the active storage backend (never a web-root path). */
  @Prop({ type: String, required: true })
  storedPath: string;

  @Prop({ type: String, required: true })
  mimeType: string;

  @Prop({ type: Number, required: true })
  sizeBytes: number;

  @Prop({ type: String, ref: 'User', default: null })
  uploadedByUserId: string | null;

  declare case?: DentalCase;
  declare uploadedByUser?: User | null;
}

export type CaseFileDocument = HydratedDocument<CaseFile>;
export const CaseFileSchema = SchemaFactory.createForClass(CaseFile);

CaseFileSchema.virtual('case', {
  ref: 'DentalCase',
  localField: 'caseId',
  foreignField: '_id',
  justOne: true,
});
CaseFileSchema.virtual('uploadedByUser', {
  ref: 'User',
  localField: 'uploadedByUserId',
  foreignField: '_id',
  justOne: true,
});
