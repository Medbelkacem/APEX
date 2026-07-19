import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, UserRole, UserStatus } from '@dental/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { DentistsService } from './dentists.service';
import {
  CreateDentistDto,
  ListDentistsDto,
  RejectDentistDto,
  UpdateDentistDto,
} from './dentists.dto';
import { Query } from '@nestjs/common';

/** Admin dentist management. */
@ApiTags('dentists')
@Controller('dentists')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class DentistsController {
  constructor(
    private readonly dentists: DentistsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List dentists with search/filter/pagination.' })
  list(@Query() query: ListDentistsDto) {
    return this.dentists.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a dentist (User + profile) and send an invitation.' })
  async create(@Body() dto: CreateDentistDto, @CurrentUser() actor: AuthenticatedUser) {
    const dentist = await this.dentists.create(dto);
    await this.audit.record({
      userId: actor.id,
      action: 'dentist.created',
      entityType: 'dentist',
      entityId: dentist.id,
    });
    return dentist;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a dentist by id.' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.dentists.findByIdOrFail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a dentist profile.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDentistDto) {
    return this.dentists.update(id, dto);
  }

  @Post(':id/disable')
  @ApiOperation({ summary: 'Disable a dentist account.' })
  async disable(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    const dentist = await this.dentists.setStatus(id, UserStatus.DISABLED);
    await this.audit.record({
      userId: actor.id,
      action: 'dentist.disabled',
      entityType: 'dentist',
      entityId: id,
    });
    return dentist;
  }

  @Post(':id/enable')
  @ApiOperation({ summary: 'Re-enable a dentist account.' })
  enable(@Param('id', ParseUUIDPipe) id: string) {
    return this.dentists.setStatus(id, UserStatus.ACTIVE);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Send a password reset email to a dentist.' })
  async resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    await this.dentists.sendPasswordReset(id);
    return { success: true };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a pending self-registration, opening the account.' })
  async approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    const dentist = await this.dentists.approve(id);
    await this.audit.record({
      userId: actor.id,
      action: 'dentist.approved',
      entityType: 'dentist',
      entityId: id,
      metadata: { email: dentist.user?.email },
    });
    return dentist;
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Decline a pending self-registration.' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDentistDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const dentist = await this.dentists.reject(id, dto.reason);
    await this.audit.record({
      userId: actor.id,
      action: 'dentist.rejected',
      entityType: 'dentist',
      entityId: id,
      // Who turned an applicant away, and why, is exactly the kind of decision
      // someone will need to reconstruct later.
      metadata: { email: dentist.user?.email, reason: dto.reason ?? null },
    });
    return dentist;
  }
}
