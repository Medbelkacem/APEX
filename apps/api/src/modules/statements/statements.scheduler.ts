import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StatementsService } from './statements.service';

/**
 * Monthly statement run. Fires at 02:00 on the 1st and closes out the month
 * that just ended, so every invoice issued in the period is already in place.
 */
@Injectable()
export class StatementsScheduler {
  private readonly logger = new Logger(StatementsScheduler.name);

  constructor(private readonly statements: StatementsService) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, { name: 'monthly-statements' })
  async run(): Promise<void> {
    const now = new Date();
    // Step back one day to land inside the previous month.
    const previous = new Date(now.getFullYear(), now.getMonth(), 0);
    const year = previous.getFullYear();
    const month = previous.getMonth() + 1;

    this.logger.log(`Generating monthly statements for ${year}-${String(month).padStart(2, '0')}`);
    try {
      const { created } = await this.statements.generateAll(year, month);
      this.logger.log(`Monthly statement run complete — ${created} statement(s) generated`);
    } catch (err) {
      this.logger.error(`Monthly statement run failed: ${String(err)}`);
    }
  }
}
