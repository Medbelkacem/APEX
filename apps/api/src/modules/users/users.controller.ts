import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, UserRole, UserStatus } from '@dental/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccountEmailsService } from '../../mail/account-emails.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from './users.service';
import { CreateUserDto, ListUsersDto, UpdateUserDto } from './users.dto';

/** Admin staff-account management. Super-admin only for create/enable/disable. */
@ApiTags('users')
@Controller('users')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly accountEmails: AccountEmailsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List staff/users with filters.' })
  list(@Query() query: ListUsersDto) {
    return this.users.list(query);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create an admin account and send an invitation email.' })
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    const user = await this.users.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
      phone: dto.phone ?? null,
    });
    const token = await this.users.issueResetToken(user.id, 7 * 24 * 3600);
    await this.accountEmails.sendInvitation(user, token);
    await this.audit.record({
      userId: actor.id,
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      metadata: { role: user.role },
    });
    return user;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id.' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findByIdOrFail(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a user.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Post(':id/disable')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Disable a user account.' })
  async disable(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    const user = await this.users.setStatus(id, UserStatus.DISABLED);
    await this.audit.record({
      userId: actor.id,
      action: 'user.disabled',
      entityType: 'user',
      entityId: id,
    });
    return user;
  }

  @Post(':id/enable')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Re-enable a user account.' })
  enable(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.setStatus(id, UserStatus.ACTIVE);
  }

  @Post(':id/reset-password')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Send a password reset email to a user.' })
  async resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.users.findByIdOrFail(id);
    const token = await this.users.issueResetToken(user.id);
    await this.accountEmails.sendPasswordReset(user, token);
    return { success: true };
  }
}
