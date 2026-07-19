import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities';
import { PasswordService } from '../../common/security/password.service';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, PasswordService],
  controllers: [UsersController],
  // AuthService verifies and upgrades hashes, so it needs the hasher too.
  exports: [UsersService, PasswordService],
})
export class UsersModule {}
