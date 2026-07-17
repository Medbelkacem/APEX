import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app.config';
import { MailService } from './mail.service';
import { emailTemplates } from './templates';

interface EmailRecipient {
  id: string;
  email: string;
  firstName: string;
}

/**
 * Builds and enqueues account-lifecycle emails (invitation, password reset).
 * Depends only on MailService + config, so it can be injected by Auth, Users,
 * and Dentists without creating circular module references.
 */
@Injectable()
export class AccountEmailsService {
  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private get webUrl(): string {
    return this.config.get<AppConfig>('app')!.webUrl;
  }

  async sendInvitation(user: EmailRecipient, rawToken: string): Promise<void> {
    const setupUrl = `${this.webUrl}/reset-password?uid=${user.id}&token=${encodeURIComponent(
      rawToken,
    )}&setup=1`;
    const tpl = emailTemplates.dentistInvitation({ firstName: user.firstName, setupUrl });
    await this.mail.enqueue({ to: user.email, ...tpl });
  }

  async sendPasswordReset(user: EmailRecipient, rawToken: string): Promise<void> {
    const resetUrl = `${this.webUrl}/reset-password?uid=${user.id}&token=${encodeURIComponent(
      rawToken,
    )}`;
    const tpl = emailTemplates.passwordReset({ firstName: user.firstName, resetUrl });
    await this.mail.enqueue({ to: user.email, ...tpl });
  }
}
