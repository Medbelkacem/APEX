import { Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { StatementsService } from '../statements/statements.service';

/**
 * HTTP triggers for the jobs @nestjs/schedule's @Cron decorators run
 * in-process on Docker/Render. Vercel serverless has no persistent process
 * for those timers to fire on, so Vercel Cron (see vercel.json) calls these
 * instead, on the same schedule. Same underlying service methods either way
 * — this is only a different trigger, not different behavior.
 *
 * Excluded from Swagger: not a route any client is meant to call, only
 * Vercel's own cron dispatcher, authorized by CronSecretGuard.
 */
@ApiExcludeController()
@Controller('cron')
@Public()
@SkipCsrf()
@UseGuards(CronSecretGuard)
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private readonly refreshTokens: RefreshTokenService,
    private readonly statements: StatementsService,
  ) {}

  @Post('purge-refresh-tokens')
  async purgeRefreshTokens(): Promise<{ removed: number }> {
    const removed = await this.refreshTokens.purgeExpired();
    if (removed > 0) this.logger.log(`Purged ${removed} expired refresh token(s)`);
    return { removed };
  }

  @Post('monthly-statements')
  async monthlyStatements(): Promise<{ year: number; month: number; created: number }> {
    const now = new Date();
    // Step back one day to land inside the previous month — matching
    // StatementsScheduler's own EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT logic.
    const previous = new Date(now.getFullYear(), now.getMonth(), 0);
    const year = previous.getFullYear();
    const month = previous.getMonth() + 1;

    this.logger.log(`Generating monthly statements for ${year}-${String(month).padStart(2, '0')}`);
    const { created } = await this.statements.generateAll(year, month);
    this.logger.log(`Monthly statement run complete — ${created} statement(s) generated`);
    return { year, month, created };
  }
}
