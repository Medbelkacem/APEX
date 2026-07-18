import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { Response } from 'express';
import { AuthenticatedUser, UserRole } from '@dental/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { StatementsService } from './statements.service';

const period = {
  year: z.coerce.number().int().min(2000).max(2200),
  month: z.coerce.number().int().min(1).max(12),
};

export const listStatementsSchema = z.object({
  dentistId: z.string().uuid().optional(),
  year: z.coerce.number().int().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export class ListStatementsDto extends createZodDto(listStatementsSchema) {}

export const generateStatementSchema = z.object({ dentistId: z.string().uuid(), ...period });
export class GenerateStatementDto extends createZodDto(generateStatementSchema) {}

export const generateAllSchema = z.object(period);
export class GenerateAllStatementsDto extends createZodDto(generateAllSchema) {}

@ApiTags('statements')
@Controller('statements')
export class StatementsController {
  constructor(
    private readonly statements: StatementsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List statements — dentists see only their own.' })
  list(@Query() query: ListStatementsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.statements.list(query, user);
  }

  @Post('generate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate one dentist’s statement for a period.' })
  async generate(@Body() dto: GenerateStatementDto, @CurrentUser() actor: AuthenticatedUser) {
    const statement = await this.statements.generate(dto.dentistId, dto.year, dto.month);
    await this.audit.record({
      userId: actor.id,
      action: 'statement.generated',
      entityType: 'monthly_statement',
      entityId: statement.id,
      metadata: { dentistId: dto.dentistId, year: dto.year, month: dto.month },
    });
    return statement;
  }

  @Post('generate-all')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate statements for every active dentist.' })
  async generateAll(@Body() dto: GenerateAllStatementsDto, @CurrentUser() actor: AuthenticatedUser) {
    const result = await this.statements.generateAll(dto.year, dto.month);
    await this.audit.record({
      userId: actor.id,
      action: 'statement.generated_all',
      entityType: 'monthly_statement',
      metadata: { year: dto.year, month: dto.month, created: result.created },
    });
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Statement detail.' })
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.statements.findScoped(id, user);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download the statement PDF.' })
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.statements.pdfFor(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  }

  @Post(':id/send')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Email a statement to its dentist.' })
  async send(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    await this.statements.send(id);
    await this.audit.record({
      userId: actor.id,
      action: 'statement.sent',
      entityType: 'monthly_statement',
      entityId: id,
    });
    return { success: true };
  }
}
