import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseDocument, baseSchemaOptions } from '../base.schema';

/** Key/value store for global platform configuration (secrets encrypted). */
@Schema(baseSchemaOptions('platform_settings'))
export class PlatformSetting extends BaseDocument {
  /** e.g. stripe.secret_key, smtp.host. */
  @Prop({ type: String, required: true, unique: true })
  key: string;

  /** Text; encrypted at rest for secret keys. */
  @Prop({ type: String, default: null })
  value: string | null;

  /** Whether `value` is stored encrypted (redacted when listed via the API). */
  @Prop({ type: Boolean, default: false })
  isSecret: boolean;

  @Prop({ type: String, default: null })
  updatedByUserId: string | null;
}

export type PlatformSettingDocument = HydratedDocument<PlatformSetting>;
export const PlatformSettingSchema = SchemaFactory.createForClass(PlatformSetting);
