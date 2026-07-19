import { Logger } from '@nestjs/common';
import { MailTransport, SendMailInput } from '../mail-transport.interface';

/**
 * No-op transport that logs emails instead of sending them — `MAIL_DRIVER=log`,
 * the default for local development and the test suite.
 *
 * The plain-text body is logged at info rather than debug because it carries
 * the invitation, verification and password-reset links. Under the default
 * `LOG_LEVEL=info` a debug line is invisible, which left the only copy of those
 * links unreachable and made the whole first-login flow untestable without an
 * SMTP server.
 *
 * That means single-use tokens end up in the log. This transport delivers
 * nothing, so it is only ever selected where mail is deliberately going
 * nowhere; anywhere real, `MAIL_DRIVER` is `smtp` or `sendgrid` and this file
 * is not in play.
 */
export class LogTransport implements MailTransport {
  private readonly logger = new Logger('MailLog');

  async send(input: SendMailInput): Promise<void> {
    this.logger.log(`[email] to=${input.to} subject="${input.subject}"`);
    if (input.text) this.logger.log(`[email:text] ${input.text}`);
  }
}
