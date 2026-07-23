import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseDocument, baseSchemaOptions } from '../base.schema';

/** A submission from the public marketing contact form. */
@Schema(baseSchemaOptions('contact_messages'))
export class ContactMessage extends BaseDocument {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, required: true })
  subject: string;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({ type: String, default: null })
  ipAddress: string | null;

  /** Whether an admin has followed up on this message. */
  @Prop({ type: Boolean, default: false })
  isHandled: boolean;
}

export type ContactMessageDocument = HydratedDocument<ContactMessage>;
export const ContactMessageSchema = SchemaFactory.createForClass(ContactMessage);
