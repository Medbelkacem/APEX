import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

/**
 * JwtModule is registered globally in AppModule, so JwtService is available here
 * (and to the global JwtAuthGuard) without re-importing.
 */
@Module({
  imports: [UsersModule],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
