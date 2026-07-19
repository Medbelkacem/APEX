import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthenticatedUser, UserRole } from '@dental/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from '../payments/payments.service';
import { InvoicesService } from './invoices.service';
import {
  GenerateBatchDto,
  GenerateInvoiceDto,
  ListInvoicesDto,
  MarkPaidDto,
} from './invoices.dto';

@ApiTags('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List invoices — dentists see only their own issued ones.' })
  list(@Query() query: ListInvoicesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.list(query, user);
  }

  @Get('outstanding')
  @ApiOperation({ summary: 'Unpaid balance for the current user.' })
  outstanding(@CurrentUser() user: AuthenticatedUser) {
    return this.invoices.outstanding(user);
  }

  @Post('generate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate a draft invoice for a single case.' })
  async generate(@Body() dto: GenerateInvoiceDto, @CurrentUser() actor: AuthenticatedUser) {
    const invoice = await this.invoices.generateForCase(dto);
    await this.audit.record({
      userId: actor.id,
      action: 'invoice.generated',
      entityType: 'invoice',
      entityId: invoice.id,
      metadata: { number: invoice.number, caseId: dto.caseId },
    });
    return invoice;
  }

  @Post('generate-batch')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Batch-invoice a dentist’s completed, uninvoiced cases.' })
  async generateBatch(@Body() dto: GenerateBatchDto, @CurrentUser() actor: AuthenticatedUser) {
    const result = await this.invoices.generateBatch(dto);
    if (result.invoice) {
      await this.audit.record({
        userId: actor.id,
        action: 'invoice.batch_generated',
        entityType: 'invoice',
        entityId: result.invoice.id,
        metadata: { number: result.invoice.number, cases: result.created },
      });
    }
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Invoice detail.' })
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.findScoped(id, user);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download the invoice PDF.' })
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.invoices.pdfFor(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  }

  @Post(':id/issue')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Issue a draft invoice and email it to the dentist.' })
  async issue(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    const invoice = await this.invoices.issue(id);
    await this.audit.record({
      userId: actor.id,
      action: 'invoice.issued',
      entityType: 'invoice',
      entityId: id,
      metadata: { number: invoice.number, total: invoice.total },
    });
    return invoice;
  }

  @Post(':id/mark-paid')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Record an offline payment against an invoice.' })
  async markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPaidDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const invoice = await this.invoices.markPaid(id);
    await this.audit.record({
      userId: actor.id,
      action: 'invoice.marked_paid',
      entityType: 'invoice',
      entityId: id,
      metadata: { number: invoice.number, note: dto.note ?? null, manual: true },
    });
    return invoice;
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cancel an unpaid invoice.' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    const invoice = await this.invoices.cancel(id);
    await this.audit.record({
      userId: actor.id,
      action: 'invoice.cancelled',
      entityType: 'invoice',
      entityId: id,
      metadata: { number: invoice.number },
    });
    return invoice;
  }

  @Post(':id/refund')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Refund a paid invoice through Stripe.' })
  async refund(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    await this.payments.refund(id);
    await this.audit.record({
      userId: actor.id,
      action: 'invoice.refunded',
      entityType: 'invoice',
      entityId: id,
    });
    return this.invoices.findByIdOrFail(id);
  }

  @Post(':id/payment-intent')
  @ApiOperation({ summary: 'Start an online card payment for an invoice.' })
  paymentIntent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.createPaymentIntent(id, user);
  }
}

/**
 * Stripe webhook receiver. Public by necessity — Stripe cannot present a
 * session cookie — and authenticated instead by the payload signature, which
 * is verified against the untouched raw body.
 */
@ApiTags('invoices')
@Controller('payments')
export class PaymentsWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('webhook')
  @Public()
  // Stripe is not a browser and holds no cookie of ours, so there is nothing
  // for a forged request to borrow. The signature is this route's credential.
  @SkipCsrf()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) throw new BadRequestException('Missing stripe-signature header');
    if (!req.rawBody) throw new BadRequestException('Raw request body unavailable');
    return this.payments.handleWebhook(req.rawBody, signature);
  }
}
