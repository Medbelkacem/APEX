import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MailConfig } from '../../config/mail';
import { MailTransport, SendMailInput } from '../mail-transport.interface';

/**
 * SMTP transport (also covers SendGrid via its SMTP relay). The `from` address
 * is taken from mail config; individual sends only supply recipient + content.
 */
export class SmtpTransport implements MailTransport {
  private readonly logger = new Logger(SmtpTransport.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: MailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user
        ? { user: config.smtp.user, pass: config.smtp.password }
        : undefined,
    });
  }

  async send(input: SendMailInput): Promise<void> {
    await this.transporter.sendMail({
      from: `"${this.config.fromName}" <${this.config.fromAddress}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    this.logger.debug(`Sent "${input.subject}" to ${input.to}`);
  }
}
