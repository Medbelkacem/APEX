import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckError, HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /**
   * A direct `readyState`/`ping` check on the injected connection, deliberately
   * *not* `@nestjs/terminus`'s `MongooseHealthIndicator` — that indicator probes
   * for the `mongoose` package with a dynamic `require('mongoose')` from its own
   * install location, which a file-tracing bundler (Next's `output: standalone`,
   * and Vercel's function bundler the same way) does not always preserve a
   * resolvable path for, even though this app's own real `mongoose` import
   * works fine either way. That crashed the whole app boot the moment
   * anything hit `/api/health` under the Vercel-serverless build; this has no
   * such indirection.
   */
  private async pingDatabase(): Promise<HealthIndicatorResult> {
    const key = 'database';
    try {
      if (this.connection.readyState !== 1 || !this.connection.db) {
        throw new Error(`readyState ${this.connection.readyState}`);
      }
      await this.connection.db.admin().ping();
      return { [key]: { status: 'up' } };
    } catch (err) {
      // HealthCheckExecutor only counts a *thrown* HealthCheckError as a
      // failure — a plain returned { status: 'down' } would fulfil the
      // promise and get summarized as an overall "ok".
      throw new HealthCheckError('Mongo ping failed', { [key]: { status: 'down', message: String(err) } });
    }
  }

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness/readiness probe (checks the database).' })
  check() {
    return this.health.check([() => this.pingDatabase()]);
  }
}
