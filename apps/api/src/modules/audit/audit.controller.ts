import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { UserRole } from '@dental/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';

export const listAuditSchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export class ListAuditDto extends createZodDto(listAuditSchema) {}

/** Audit trail inspection. Super admin only — it records their peers' actions. */
@ApiTags('audit')
@Controller('audit-logs')
@Roles(UserRole.SUPER_ADMIN)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit log entries, newest first.' })
  list(@Query() query: ListAuditDto) {
    return this.audit.list(query);
  }
}
