import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET ?? 'insecure-dev-secret-change-me',
  accessTtl: Number(process.env.JWT_ACCESS_TTL ?? 900),
  refreshTtl: Number(process.env.JWT_REFRESH_TTL ?? 604800),
  resetTokenTtl: Number(process.env.RESET_TOKEN_TTL ?? 3600),
  // OWASP's recommended Argon2id baseline: 19 MiB, 2 passes, 1 lane.
  argon2MemoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 19456),
  argon2TimeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
  argon2Parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5),
  loginLockoutSeconds: Number(process.env.LOGIN_LOCKOUT_SECONDS ?? 900),
  cookieDomain: process.env.COOKIE_DOMAIN ?? 'localhost',
  cookieSecure: ['1', 'true', 'yes', 'on'].includes(
    (process.env.COOKIE_SECURE ?? 'false').toLowerCase(),
  ),
}));

export type AuthConfig = ReturnType<typeof authConfig>;
