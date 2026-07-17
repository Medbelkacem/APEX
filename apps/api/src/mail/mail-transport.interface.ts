export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Pluggable email transport. Implementations: SMTP/SendGrid, or a dev logger. */
export interface MailTransport {
  send(input: SendMailInput): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
