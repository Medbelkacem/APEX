import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@dental/shared-types';
import { BaseDocument, baseSchemaOptions } from '../base.schema';
import { User } from './user.entity';

/** Email and in-app notification log. */
@Schema(baseSchemaOptions('notifications'))
export class NotificationEntity extends BaseDocument {
  @Prop({ type: String, ref: 'User', required: true })
  userId: string;

  @Prop({ type: String, enum: Object.values(NotificationType), required: true })
  type: NotificationType;

  @Prop({ type: String, required: true })
  subject: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({ type: String, enum: Object.values(NotificationChannel), required: true })
  channel: NotificationChannel;

  @Prop({
    type: String,
    enum: Object.values(NotificationStatus),
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Prop({ type: String, default: null })
  relatedCaseId: string | null;

  @Prop({ type: String, default: null })
  relatedInvoiceId: string | null;

  @Prop({ type: Date, default: null })
  sentAt: Date | null;

  @Prop({ type: Date, default: null })
  readAt: Date | null;

  declare user?: User;
}

export type NotificationDocument = HydratedDocument<NotificationEntity>;
export const NotificationSchema = SchemaFactory.createForClass(NotificationEntity);

NotificationSchema.index({ userId: 1, status: 1 });
NotificationSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});
