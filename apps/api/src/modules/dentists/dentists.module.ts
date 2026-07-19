import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dentist } from '../../database/entities';
import { UsersModule } from '../users/users.module';
import { DentistsService } from './dentists.service';
import { DentistsController } from './dentists.controller';
import { RegistrationController } from './registration.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Dentist]), UsersModule],
  providers: [DentistsService],
  controllers: [DentistsController, RegistrationController],
  exports: [DentistsService],
})
export class DentistsModule {}
