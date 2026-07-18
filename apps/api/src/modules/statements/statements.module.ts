import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dentist, Invoice, MonthlyStatement } from '../../database/entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { StatementsService } from './statements.service';
import { StatementsController } from './statements.controller';
import { StatementsScheduler } from './statements.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonthlyStatement, Invoice, Dentist]),
    NotificationsModule,
  ],
  providers: [StatementsService, StatementsScheduler],
  controllers: [StatementsController],
  exports: [StatementsService],
})
export class StatementsModule {}
