import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseStatus, CaseType, DentalCase } from '../../database/entities';
import { CatalogService } from './catalog.service';
import { CaseStatusesController, CaseTypesController } from './catalog.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CaseType, CaseStatus, DentalCase])],
  providers: [CatalogService],
  controllers: [CaseTypesController, CaseStatusesController],
  exports: [CatalogService],
})
export class CatalogModule {}
