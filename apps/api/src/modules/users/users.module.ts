import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../database/entities';
import { PasswordService } from '../../common/security/password.service';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [UsersService, PasswordService],
  controllers: [UsersController],
  // AuthService verifies and upgrades hashes, so it needs the hasher too.
  exports: [UsersService, PasswordService],
})
export class UsersModule {}
