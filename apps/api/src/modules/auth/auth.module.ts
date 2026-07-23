import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RefreshToken, RefreshTokenSchema } from '../../database/entities';
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
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: RefreshToken.name, schema: RefreshTokenSchema }]),
  ],
  providers: [AuthService, RefreshTokenService, RefreshTokenScheduler],
  controllers: [AuthController],
  exports: [AuthService, RefreshTokenService],
})
export class AuthModule {}
