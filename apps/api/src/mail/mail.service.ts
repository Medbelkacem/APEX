import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_EMAIL } from '../queue/queue.constants';
import { MAIL_TRANSPORT, MailTransport, SendMailInput } from './mail-transport.interface';

export const EMAIL_JOB_SEND = 'send';

/**
 * Application-facing mail API.
 *  - `redis` queue mode: emails are enqueued onto the `email` BullMQ queue and
 *    delivered by EmailProcessor with retry/backoff (HTTP never blocks on SMTP).
 *  - `inline` mode (no Redis): the queue is absent, so we send via the transport
 *    directly, fire-and-forget, so a slow/failing send can't fail the request.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Optional() @InjectQueue(QUEUE_EMAIL) private readonly queue: Queue | undefined,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
  ) {}

  async enqueue(input: SendMailInput): Promise<void> {
    if (this.queue) {
      await this.queue.add(EMAIL_JOB_SEND, input);
      return;
    }
    // Inline mode: don't block the caller; log failures instead of throwing.
    void this.transport
      .send(input)
      .catch((err) => this.logger.error(`Inline email send failed: ${String(err)}`));
  }
}
