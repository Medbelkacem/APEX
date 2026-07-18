import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 4000),
  apiUrl: process.env.API_URL ?? 'http://localhost:4000',
  webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  sentryDsn: process.env.SENTRY_DSN || undefined,
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? 'DZD',
  defaultTimezone: process.env.DEFAULT_TIMEZONE ?? 'UTC',
}));

export type AppConfig = ReturnType<typeof appConfig>;
