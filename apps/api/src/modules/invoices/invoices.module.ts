import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Counter,
  CounterSchema,
  DentalCase,
  DentalCaseSchema,
  Dentist,
  DentistSchema,
  Invoice,
  InvoiceLineItem,
  InvoiceLineItemSchema,
  InvoiceSchema,
} from '../../database/entities';
import { CatalogModule } from '../catalog/catalog.module';
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
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: InvoiceLineItem.name, schema: InvoiceLineItemSchema },
      { name: DentalCase.name, schema: DentalCaseSchema },
      { name: Dentist.name, schema: DentistSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
    CatalogModule,
    PricingModule,
    NotificationsModule,
  ],
  providers: [InvoicesService, PaymentsService],
  controllers: [InvoicesController, PaymentsWebhookController],
  exports: [InvoicesService, PaymentsService],
})
export class InvoicesModule {}
