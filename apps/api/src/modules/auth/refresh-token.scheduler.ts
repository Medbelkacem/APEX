import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Housekeeping for `refresh_tokens`.
 *
 * Spent tokens are kept on purpose — a spent token reappearing is how theft is
 * detected — so the table only ever grows without this. Rows are removed once
 * they are past their absolute expiry, at which point no token in the family
 * could be accepted anyway and retaining them proves nothing.
 */
@Injectable()
export class RefreshTokenScheduler {
  private readonly logger = new Logger(RefreshTokenScheduler.name);

  constructor(private readonly refreshTokens: RefreshTokenService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'purge-expired-refresh-tokens' })
  async run(): Promise<void> {
    try {
      const removed = await this.refreshTokens.purgeExpired();
      if (removed > 0) {
        this.logger.log(`Purged ${removed} expired refresh token(s)`);
      }
    } catch (err) {
      this.logger.error(`Refresh token purge failed: ${String(err)}`);
    }
  }
}
