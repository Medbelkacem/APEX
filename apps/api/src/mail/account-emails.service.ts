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

  async sendEmailVerification(user: EmailRecipient, rawToken: string): Promise<void> {
    const verifyUrl = `${this.webUrl}/verify-email?uid=${user.id}&token=${encodeURIComponent(
      rawToken,
    )}`;
    const tpl = emailTemplates.verifyEmail({ firstName: user.firstName, verifyUrl });
    await this.mail.enqueue({ to: user.email, ...tpl });
  }

  /**
   * Sent instead of a verification mail when the address is already registered.
   * Registration cannot say "that email is taken" without confirming to a
   * stranger who is registered here, so the notice goes to the address itself —
   * where only its owner can read it.
   */
  async sendRegistrationAttempted(user: EmailRecipient): Promise<void> {
    const tpl = emailTemplates.registrationAttempted({
      firstName: user.firstName,
      loginUrl: `${this.webUrl}/login`,
      resetUrl: `${this.webUrl}/forgot-password`,
    });
    await this.mail.enqueue({ to: user.email, ...tpl });
  }

  async sendAccountApproved(user: EmailRecipient): Promise<void> {
    const tpl = emailTemplates.accountApproved({
      firstName: user.firstName,
      loginUrl: `${this.webUrl}/login`,
    });
    await this.mail.enqueue({ to: user.email, ...tpl });
  }

  async sendAccountRejected(user: EmailRecipient, reason?: string | null): Promise<void> {
    const tpl = emailTemplates.accountRejected({ firstName: user.firstName, reason });
    await this.mail.enqueue({ to: user.email, ...tpl });
  }

  /** Notify the lab that a confirmed registration is waiting to be reviewed. */
  async sendRegistrationPendingReview(
    to: string[],
    details: { dentistName: string; email: string; clinicName?: string | null },
  ): Promise<void> {
    if (to.length === 0) return;
    const tpl = emailTemplates.registrationPendingReview({
      ...details,
      reviewUrl: `${this.webUrl}/admin/dentists?status=pending`,
    });
    await Promise.all(to.map((address) => this.mail.enqueue({ to: address, ...tpl })));
  }
}
