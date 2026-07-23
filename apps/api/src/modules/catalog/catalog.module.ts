import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CaseStatus,
  CaseStatusSchema,
  CaseType,
  CaseTypeSchema,
  DentalCase,
  DentalCaseSchema,
} from '../../database/entities';
import { CatalogService } from './catalog.service';
import { CaseStatusesController, CaseTypesController } from './catalog.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CaseType.name, schema: CaseTypeSchema },
      { name: CaseStatus.name, schema: CaseStatusSchema },
      { name: DentalCase.name, schema: DentalCaseSchema },
    ]),
  ],
  providers: [CatalogService],
  controllers: [CaseTypesController, CaseStatusesController],
  exports: [CatalogService],
})
export class CatalogModule {}
