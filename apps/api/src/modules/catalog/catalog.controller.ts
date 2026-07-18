import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@dental/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CatalogService } from './catalog.service';
import {
  CreateCaseStatusDto,
  CreateCaseTypeDto,
  ReorderDto,
  UpdateCaseStatusDto,
  UpdateCaseTypeDto,
} from './catalog.dto';

/**
 * Case-type catalog. Reads are public so the marketing Services page and the
 * case-submission form share one source of truth; writes are admin-only.
 */
@ApiTags('catalog')
@Controller('catalog/case-types')
export class CaseTypesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List case types (public — drives the Services page).' })
  list(@Query('includeInactive') includeInactive?: string) {
    return this.catalog.listCaseTypes(includeInactive === 'true');
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a case type.' })
  create(@Body() dto: CreateCaseTypeDto) {
    return this.catalog.createCaseType(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a case type.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCaseTypeDto) {
    return this.catalog.updateCaseType(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Remove a case type (deactivated instead if in use).' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.removeCaseType(id);
  }
}

/** Admin-managed production workflow statuses. */
@ApiTags('catalog')
@Controller('catalog/case-statuses')
export class CaseStatusesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List workflow statuses (any authenticated user).' })
  list(@Query('includeInactive') includeInactive?: string) {
    return this.catalog.listStatuses(includeInactive === 'true');
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a workflow status.' })
  create(@Body() dto: CreateCaseStatusDto) {
    return this.catalog.createStatus(dto);
  }

  @Post('reorder')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Persist a new status ordering (drag-and-drop).' })
  reorder(@Body() dto: ReorderDto) {
    return this.catalog.reorderStatuses(dto.ids);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a workflow status.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCaseStatusDto) {
    return this.catalog.updateStatus(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a workflow status (blocked while in use).' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.removeStatus(id);
  }
}
