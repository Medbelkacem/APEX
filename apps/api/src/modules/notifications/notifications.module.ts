import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  NotificationEntity,
  NotificationSchema,
  User,
  UserSchema,
} from '../../database/entities';
import { NotificationsService } from './notifications.service';
import {
  AdminNotificationsController,
  NotificationsController,
} from './notifications.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationEntity.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [NotificationsService],
  controllers: [NotificationsController, AdminNotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
