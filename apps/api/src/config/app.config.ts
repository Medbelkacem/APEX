import { registerAs } from '@nestjs/config';

/**
 * Translate TRUST_PROXY into Express's `trust proxy` value: unset → trust
 * nothing; `true`/`false`; a hop count; otherwise passed through as a name
 * (`loopback`) or a comma-separated list of addresses/CIDRs.
 */
export function parseTrustProxy(raw: string | undefined): boolean | number | string {
  const value = (raw ?? '').trim();
  if (value === '') return false;
  const lower = value.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(lower)) return lower === '1' ? 1 : true;
  if (['0', 'false', 'no', 'off'].includes(lower)) return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 4000),
  apiUrl: process.env.API_URL ?? 'http://localhost:4000',
  webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  apiDocsEnabled: ['1', 'true', 'yes', 'on'].includes(
    (process.env.API_DOCS_ENABLED ?? 'false').toLowerCase(),
  ),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  sentryDsn: process.env.SENTRY_DSN || undefined,
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? 'USD',
  defaultTimezone: process.env.DEFAULT_TIMEZONE ?? 'UTC',
}));

export type AppConfig = ReturnType<typeof appConfig>;
