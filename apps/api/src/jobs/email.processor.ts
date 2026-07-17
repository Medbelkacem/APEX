import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_EMAIL } from '../queue/queue.constants';
import { MAIL_TRANSPORT, MailTransport, SendMailInput } from '../mail/mail-transport.interface';

/**
 * Consumes `email` jobs and delivers them via the configured transport.
 * Throwing lets BullMQ apply the retry/backoff policy from DEFAULT_JOB_OPTIONS.
 */
@Processor(QUEUE_EMAIL)
export class EmailProcessor extends WorkerHost {
  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {
    super();
  }

  async process(job: Job<SendMailInput>): Promise<void> {
    await this.transport.send(job.data);
  }
}
