import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../../database/entities';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshTokenScheduler } from './refresh-token.scheduler';

/**
 * JwtModule is registered globally in AppModule, so JwtService is available here
 * (and to the global JwtAuthGuard) without re-importing.
 */
@Module({
  imports: [UsersModule, TypeOrmModule.forFeature([RefreshToken])],
  providers: [AuthService, RefreshTokenService, RefreshTokenScheduler],
  controllers: [AuthController],
  exports: [AuthService, RefreshTokenService],
})
export class AuthModule {}
