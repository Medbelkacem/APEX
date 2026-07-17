import { Global, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailConfig } from '../config/mail';
import { MailService } from './mail.service';
import { AccountEmailsService } from './account-emails.service';
import { MAIL_TRANSPORT } from './mail-transport.interface';
import { SmtpTransport } from './transports/smtp.transport';
import { LogTransport } from './transports/log.transport';
import { EmailProcessor } from '../jobs/email.processor';

const transportProvider: Provider = {
  provide: MAIL_TRANSPORT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const mail = config.get<MailConfig>('mail')!;
    return mail.driver === 'log' ? new LogTransport() : new SmtpTransport(mail);
  },
};

// The BullMQ worker is only needed when a real queue exists (redis mode).
const queueProviders: Provider[] =
  (process.env.QUEUE_DRIVER ?? 'redis') === 'redis' ? [EmailProcessor] : [];

/**
 * Wires the mail transport (chosen by MAIL_DRIVER), the MailService, and — in
 * redis queue mode — the EmailProcessor worker. Global so any module can inject
 * MailService / AccountEmailsService.
 */
@Global()
@Module({
  providers: [transportProvider, MailService, AccountEmailsService, ...queueProviders],
  exports: [MailService, AccountEmailsService, MAIL_TRANSPORT],
})
export class MailModule {}
