import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Dentist,
  DentistSchema,
  Invoice,
  InvoiceSchema,
  MonthlyStatement,
  MonthlyStatementSchema,
} from '../../database/entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { StatementsService } from './statements.service';
import { StatementsController } from './statements.controller';
import { StatementsScheduler } from './statements.scheduler';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MonthlyStatement.name, schema: MonthlyStatementSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Dentist.name, schema: DentistSchema },
    ]),
    NotificationsModule,
  ],
  providers: [StatementsService, StatementsScheduler],
  controllers: [StatementsController],
  exports: [StatementsService],
})
export class StatementsModule {}
