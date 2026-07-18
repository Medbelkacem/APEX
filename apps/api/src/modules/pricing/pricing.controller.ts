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
import { AuthenticatedUser, UserRole } from '@dental/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { PricingService } from './pricing.service';
import {
  CreatePricingRuleDto,
  ListPricingRulesDto,
  QuoteDto,
  UpdatePricingRuleDto,
} from './pricing.dto';

@ApiTags('pricing')
@Controller('pricing')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class PricingController {
  constructor(
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List pricing rules.' })
  list(@Query() query: ListPricingRulesDto) {
    return this.pricing.list(query);
  }

  @Post('quote')
  @ApiOperation({ summary: 'Preview the price a case would be invoiced at.' })
  quote(@Body() dto: QuoteDto) {
    return this.pricing.quote(dto.caseTypeId, dto.material, dto.dentistTier);
  }

  @Post()
  @ApiOperation({ summary: 'Create a pricing rule.' })
  async create(@Body() dto: CreatePricingRuleDto, @CurrentUser() actor: AuthenticatedUser) {
    const rule = await this.pricing.create(dto);
    await this.audit.record({
      userId: actor.id,
      action: 'pricing.created',
      entityType: 'pricing_rule',
      entityId: rule.id,
      metadata: { price: rule.price, caseTypeId: rule.caseTypeId },
    });
    return rule;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a pricing rule.' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.findByIdOrFail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a pricing rule.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePricingRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const rule = await this.pricing.update(id, dto);
    await this.audit.record({
      userId: actor.id,
      action: 'pricing.updated',
      entityType: 'pricing_rule',
      entityId: id,
      metadata: { price: rule.price },
    });
    return rule;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a pricing rule.' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    await this.pricing.remove(id);
    await this.audit.record({
      userId: actor.id,
      action: 'pricing.deleted',
      entityType: 'pricing_rule',
      entityId: id,
    });
    return { success: true };
  }
}
