import { Logger } from '@nestjs/common';
import { MailTransport, SendMailInput } from '../mail-transport.interface';

/** No-op transport that logs emails instead of sending — used in tests / MAIL_DRIVER=log. */
export class LogTransport implements MailTransport {
  private readonly logger = new Logger('MailLog');

  async send(input: SendMailInput): Promise<void> {
    this.logger.log(`[email] to=${input.to} subject="${input.subject}"`);
    // Handy in dev: the text body carries invitation/reset links.
    if (input.text) this.logger.debug(`[email:text] ${input.text}`);
  }
}
