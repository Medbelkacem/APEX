import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { BaseDocument, baseSchemaOptions } from '../base.schema';

/** Immutable audit trail of sensitive admin actions. */
@Schema(baseSchemaOptions('audit_logs'))
export class AuditLog extends BaseDocument {
  @Prop({ type: String, default: null })
  userId: string | null;

  /** e.g. case.status_changed, dentist.disabled, pricing.updated. */
  @Prop({ type: String, required: true })
  action: string;

  @Prop({ type: String, required: true })
  entityType: string;

  @Prop({ type: String, default: null })
  entityId: string | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  metadata: Record<string, unknown> | null;

  @Prop({ type: String, default: null })
  ipAddress: string | null;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ entityType: 1, entityId: 1 });
