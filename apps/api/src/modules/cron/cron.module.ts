import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StatementsModule } from '../statements/statements.module';
import { CronController } from './cron.controller';

/**
 * HTTP triggers for the jobs `@nestjs/schedule`'s `@Cron` decorators run
 * in-process on a persistent server. See CronController and CronSecretGuard
 * for why this exists.
 */
@Module({
  imports: [AuthModule, StatementsModule],
  controllers: [CronController],
})
export class CronModule {}
