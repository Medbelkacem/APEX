import { Logger } from '@nestjs/common';
import { MailConfig } from '../../config/mail';
import { MailTransport, SendMailInput } from '../mail-transport.interface';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
/** Brevo's HTTP API, not SMTP — the point of this transport is to work on a host that blocks outbound SMTP ports (e.g. Render's free plan). */
const REQUEST_TIMEOUT_MS = 10_000;

export class BrevoTransport implements MailTransport {
  private readonly logger = new Logger(BrevoTransport.name);

  constructor(private readonly config: MailConfig) {
    if (!config.brevoApiKey) {
      // Fail at boot, the same way the S3 driver fails on missing
      // credentials — a silently-broken mail path is worse than not booting.
      throw new Error('MAIL_DRIVER=brevo needs BREVO_API_KEY');
    }
  }

  async send(input: SendMailInput): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(BREVO_ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'api-key': this.config.brevoApiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: this.config.fromName, email: this.config.fromAddress },
          to: [{ email: input.to }],
          subject: input.subject,
          htmlContent: input.html,
          textContent: input.text,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Brevo API responded ${res.status}: ${body.slice(0, 500)}`);
      }
      this.logger.debug(`Sent "${input.subject}" to ${input.to} via Brevo`);
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(`Brevo API call timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
