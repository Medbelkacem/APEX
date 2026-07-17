import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_EMAIL, QUEUE_PDF, QUEUE_STATEMENTS, DEFAULT_JOB_OPTIONS } from './queue.constants';

/**
 * Central queue setup. In `redis` mode it registers the BullMQ connection and
 * platform queues; in `inline` mode it registers nothing (no Redis needed) and
 * MailService falls back to sending in-process. Global so it's imported once.
 */
@Global()
@Module({})
export class QueueModule {
  static register(): DynamicModule {
    const driver = process.env.QUEUE_DRIVER ?? 'redis';

    if (driver !== 'redis') {
      return { module: QueueModule };
    }

    return {
      module: QueueModule,
      imports: [
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: {
              url:
                config.get<string>('REDIS_URL') ??
                process.env.REDIS_URL ??
                'redis://localhost:6379',
            },
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
          }),
        }),
        BullModule.registerQueue(
          { name: QUEUE_EMAIL },
          { name: QUEUE_PDF },
          { name: QUEUE_STATEMENTS },
        ),
      ],
      exports: [BullModule],
    };
  }
}
