import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AuthenticatedUser, UserRole } from '@dental/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { SETTING_KEYS, SettingsService } from './settings.service';

const ALLOWED_KEYS = Object.values(SETTING_KEYS) as [string, ...string[]];

export const updateSettingsSchema = z.object({
  // Only known keys are writable — the store is not an arbitrary KV dumping ground.
  settings: z
    .array(
      z.object({
        key: z.enum(ALLOWED_KEYS),
        value: z.string().nullable(),
      }),
    )
    .min(1),
});
export class UpdateSettingsDto extends createZodDto(updateSettingsSchema) {}

/** Global platform configuration. Super admin only. */
@ApiTags('settings')
@Controller('settings')
@Roles(UserRole.SUPER_ADMIN)
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List platform settings (secret values redacted).' })
  list() {
    return this.settings.listRedacted();
  }

  @Put()
  @ApiOperation({ summary: 'Update one or more platform settings.' })
  async update(@Body() dto: UpdateSettingsDto, @CurrentUser() actor: AuthenticatedUser) {
    for (const setting of dto.settings) {
      await this.settings.set(setting.key, setting.value, actor.id);
    }
    await this.audit.record({
      userId: actor.id,
      action: 'settings.updated',
      entityType: 'platform_setting',
      // Log which keys changed, never the values — some are secrets.
      metadata: { keys: dto.settings.map((s) => s.key) },
    });
    return this.settings.listRedacted();
  }
}
