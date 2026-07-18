import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DentalCase, Dentist, Invoice, InvoiceLineItem } from '../../database/entities';
import { PricingModule } from '../pricing/pricing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsService } from '../payments/payments.service';
import { InvoicesService } from './invoices.service';
import { InvoicesController, PaymentsWebhookController } from './invoices.controller';

/**
 * Invoicing plus the Stripe payment flow. Payments live here rather than in a
 * separate module because the two are mutually dependent — settling a payment
 * is an invoice state change.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceLineItem, DentalCase, Dentist]),
    PricingModule,
    NotificationsModule,
  ],
  providers: [InvoicesService, PaymentsService],
  controllers: [InvoicesController, PaymentsWebhookController],
  exports: [InvoicesService, PaymentsService],
})
export class InvoicesModule {}
