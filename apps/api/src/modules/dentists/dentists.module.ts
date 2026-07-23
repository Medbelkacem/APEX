import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Dentist, DentistSchema, User, UserSchema } from '../../database/entities';
import { UsersModule } from '../users/users.module';
import { DentistsService } from './dentists.service';
import { DentistsController } from './dentists.controller';
import { RegistrationController } from './registration.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Dentist.name, schema: DentistSchema },
      { name: User.name, schema: UserSchema },
    ]),
    UsersModule,
  ],
  providers: [DentistsService],
  controllers: [DentistsController, RegistrationController],
  exports: [DentistsService],
})
export class DentistsModule {}
