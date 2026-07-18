import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DentalCase, Dentist, Invoice, User } from '../../database/entities';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DentalCase, Invoice, Dentist, User])],
  providers: [StatisticsService],
  controllers: [StatisticsController],
  exports: [StatisticsService],
})
export class StatisticsModule {}
