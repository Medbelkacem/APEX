import { registerAs } from '@nestjs/config';

export const mailConfig = registerAs('mail', () => ({
  driver: (process.env.MAIL_DRIVER ?? 'smtp') as 'smtp' | 'sendgrid' | 'log',
  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    secure: ['1', 'true', 'yes', 'on'].includes(
      (process.env.SMTP_SECURE ?? 'false').toLowerCase(),
    ),
  },
  sendgridApiKey: process.env.SENDGRID_API_KEY ?? '',
  fromName: process.env.MAIL_FROM_NAME ?? 'Apex Digital Lab',
  fromAddress: process.env.MAIL_FROM_ADDRESS ?? 'no-reply@apex.example',
}));

export type MailConfig = ReturnType<typeof mailConfig>;
