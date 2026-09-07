import { z } from 'zod';

/**
 * Coerce common truthy/falsy string env values into real booleans.
 * Accepts: true/false, 1/0, yes/no, on/off (case-insensitive).
 */
const zBool = (def: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .transform((v) => {
      if (typeof v === 'boolean') return v;
      return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
    })
    .default(def);

/**
 * Secrets that ship in templates and docs. Any of them in a production
 * environment means the deployment was never given a secret of its own.
 */
const WELL_KNOWN_SECRETS = new Set([
  'change-me-in-production-please-use-a-long-random-string',
  'insecure-dev-secret-change-me',
  'test-secret-value-at-least-16-chars',
  'ci-test-secret-value-please-change',
]);

/**
 * Central environment schema. The application refuses to boot if a required
 * variable is missing or malformed — fail fast, never run half-configured.
 */
export const envObjectSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // App
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_URL: z.string().url().default('http://localhost:4000'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  // How many reverse proxies sit in front of the API, or which ones to trust
  // (Express's `trust proxy` setting: a hop count, `loopback`, a CIDR list, or
  // `true`). Unset means none — the socket address is the client. Set it in
  // production, or every client behind the proxy shares one rate-limit bucket
  // and the audit trail records the proxy instead of the caller.
  TRUST_PROXY: z.string().optional().default(''),
  // The Swagger UI at /docs is on by default outside production. It maps the
  // whole API for anyone who can reach it, so in production it is opt-in.
  API_DOCS_ENABLED: zBool(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SENTRY_DSN: z.string().optional(),

  // Database (MongoDB). Provide a full MONGODB_URI, or leave it unset and the
  // connection string is assembled from the discrete MONGO_* parts below.
  MONGODB_URI: z.string().optional(),
  MONGO_HOST: z.string().default('localhost'),
  MONGO_PORT: z.coerce.number().int().positive().default(27017),
  MONGO_DB: z.string().default('dental'),
  MONGO_USER: z.string().optional().default(''),
  MONGO_PASSWORD: z.string().optional().default(''),
  MONGO_AUTH_SOURCE: z.string().optional().default('admin'),
  MONGO_REPLICA_SET: z.string().optional(),

  // Redis / queue. 'redis' uses BullMQ (needs Redis); 'inline' sends emails
  // directly in-process (no Redis) — handy for local dev without infra.
  QUEUE_DRIVER: z.enum(['redis', 'inline']).default('redis'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Auth
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604800),
  SESSION_IDLE_TTL: z.coerce.number().int().positive().default(1800),
  REFRESH_REUSE_LEEWAY: z.coerce.number().int().min(0).default(10),
  RESET_TOKEN_TTL: z.coerce.number().int().positive().default(3600),
  // Argon2id cost. The floors are low enough for a fast test run and high
  // enough that a production typo cannot quietly disable the work factor.
  ARGON2_MEMORY_COST: z.coerce.number().int().min(1024).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(1).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_SECONDS: z.coerce.number().int().positive().default(900),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: zBool(false),

  // Stripe
  STRIPE_SECRET_KEY: z.string().default('sk_test_placeholder'),
  STRIPE_PUBLISHABLE_KEY: z.string().default('pk_test_placeholder'),
  STRIPE_WEBHOOK_SECRET: z.string().default('whsec_placeholder'),
  STRIPE_MODE: z.enum(['test', 'live']).default('test'),

  // Mail
  MAIL_DRIVER: z.enum(['smtp', 'sendgrid', 'log']).default('smtp'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_SECURE: zBool(false),
  SENDGRID_API_KEY: z.string().optional().default(''),
  MAIL_FROM_NAME: z.string().default('Apex Digital Lab'),
  MAIL_FROM_ADDRESS: z.string().email().default('no-reply@apex.example'),

  // Storage
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_ROOT: z.string().default('../../storage'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(100),
  MAX_IMAGE_MB: z.coerce.number().int().positive().default(10),
  MAX_DOCUMENT_MB: z.coerce.number().int().positive().default(25),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),

  // Platform defaults
  DEFAULT_CURRENCY: z.string().length(3).default('USD'),
  DEFAULT_TIMEZONE: z.string().default('UTC'),
});

/**
 * Production has requirements that a developer's laptop does not. They are
 * enforced here, at boot, because each of them is a silent failure at runtime:
 * a template JWT secret signs sessions anyone can forge, and an insecure cookie
 * flag hands the session to whoever is on the network path.
 */
export const envSchema = envObjectSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;

  if (env.JWT_SECRET.length < 32 || WELL_KNOWN_SECRETS.has(env.JWT_SECRET)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message:
        'must be a random secret of at least 32 characters in production — the template value signs sessions anyone can forge',
    });
  }
  if (!env.COOKIE_SECURE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['COOKIE_SECURE'],
      message: 'must be true in production — session cookies would otherwise be sent over plain HTTP',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

/**
 * Used as the `validate` hook for @nestjs/config. Throws a readable error
 * listing every invalid variable rather than failing deep inside a provider.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
