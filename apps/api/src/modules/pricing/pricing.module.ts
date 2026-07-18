import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingRule } from '../../database/entities';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PricingRule])],
  providers: [PricingService],
  controllers: [PricingController],
  exports: [PricingService],
})
export class PricingModule {}
