import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, NotificationType, UserRole } from '@dental/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { emailTemplates } from '../../mail/templates';
import { NotificationsService } from './notifications.service';
import {
  BroadcastDto,
  ListNotificationLogDto,
  ListNotificationsDto,
} from './notifications.dto';

/** The signed-in user's own notification feed (bell icon). */
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's notifications." })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListNotificationsDto) {
    return this.notifications.listForUser(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count for the bell badge.' })
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return { count: await this.notifications.countUnread(user.id) };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark every notification as read.' })
  readAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read.' })
  async read(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notifications.markRead(user.id, id);
    return { success: true };
  }
}

/** Admin notification log + ad-hoc sending. */
@ApiTags('notifications')
@Controller('admin/notifications')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminNotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Platform-wide sent-notification log.' })
  list(@Query() query: ListNotificationLogDto) {
    return this.notifications.listAll(query);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send an ad-hoc message to one dentist or broadcast to all.' })
  async send(@Body() dto: BroadcastDto, @CurrentUser() actor: AuthenticatedUser) {
    const tpl = emailTemplates.adminBroadcast({
      subject: dto.subject,
      message: dto.message,
    });
    const payload = {
      type: NotificationType.ADMIN_BROADCAST,
      subject: dto.subject,
      body: dto.message,
      email: { html: tpl.html, text: tpl.text },
    };

    const result = dto.broadcast
      ? await this.notifications.broadcastToDentists(payload)
      : (await this.notifications.notify({ ...payload, userId: dto.userId! }), {
          recipients: 1,
        });

    await this.audit.record({
      userId: actor.id,
      action: 'notification.sent',
      entityType: 'notification',
      metadata: { broadcast: Boolean(dto.broadcast), recipients: result.recipients },
    });
    return result;
  }
}
