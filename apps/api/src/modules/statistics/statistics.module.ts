import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DentalCase,
  DentalCaseSchema,
  Dentist,
  DentistSchema,
  Invoice,
  InvoiceSchema,
  User,
  UserSchema,
} from '../../database/entities';
import { CatalogModule } from '../catalog/catalog.module';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DentalCase.name, schema: DentalCaseSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Dentist.name, schema: DentistSchema },
      { name: User.name, schema: UserSchema },
    ]),
    CatalogModule,
  ],
  providers: [StatisticsService],
  controllers: [StatisticsController],
  exports: [StatisticsService],
})
export class StatisticsModule {}
