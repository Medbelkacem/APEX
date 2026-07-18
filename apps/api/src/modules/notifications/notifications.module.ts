import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity, User } from '../../database/entities';
import { NotificationsService } from './notifications.service';
import {
  AdminNotificationsController,
  NotificationsController,
} from './notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity, User])],
  providers: [NotificationsService],
  controllers: [NotificationsController, AdminNotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
