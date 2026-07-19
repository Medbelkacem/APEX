/**
 * Test environment.
 *
 * Loaded via `setupFiles`, so this runs in every Jest worker *before* the
 * application (and therefore before `@nestjs/config`) is imported. That
 * ordering matters: `@nestjs/config` merges `process.env` over the values it
 * reads from `.env`, and each `registerAs()` factory reads `process.env`
 * directly at module-init time. Setting the variables here is what keeps a
 * test run off the developer's real database, storage directory, and mail
 * transport.
 *
 * Anything already exported by the surrounding shell wins, so CI can point the
 * suite at its own service container without editing this file.
 */
import { resolve } from 'path';

function withDefault(key: string, value: string): void {
  if (!process.env[key]) process.env[key] = value;
}

/** Absolute so it never depends on the working directory Jest was launched from. */
export const TEST_STORAGE_ROOT = resolve(__dirname, '../.tmp-storage');

/** The suite always runs against its own database, never the dev one. */
export const TEST_DB_NAME = process.env.TEST_DB_NAME ?? 'dental_test';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = TEST_DB_NAME;

withDefault('DB_HOST', 'localhost');
withDefault('DB_PORT', '5432');
withDefault('DB_USER', 'dental');
withDefault('DB_PASSWORD', 'dental');

// No external infrastructure: jobs run in-process and mail is written to the
// logger instead of an SMTP socket.
withDefault('QUEUE_DRIVER', 'inline');
withDefault('MAIL_DRIVER', 'log');

withDefault('JWT_SECRET', 'test-secret-value-at-least-16-chars');
// Argon2 is deliberately expensive, and the suite logs in twice per test. At
// the production baseline (19 MiB, 2 passes) verification alone would add well
// over ten seconds across the run, so the cost is floored here. Fixtures hash
// at these same values, which also keeps `needsRehash` quiet — the upgrade path
// is exercised by its own tests, not incidentally by every login.
withDefault('ARGON2_MEMORY_COST', '1024');
withDefault('ARGON2_TIME_COST', '1');
withDefault('ARGON2_PARALLELISM', '1');

withDefault('STORAGE_DRIVER', 'local');
withDefault('STORAGE_LOCAL_ROOT', TEST_STORAGE_ROOT);

// Deterministic money and dates regardless of the developer's locale.
withDefault('DEFAULT_CURRENCY', 'USD');
withDefault('DEFAULT_TIMEZONE', 'UTC');

// Pino would otherwise print a JSON line per request across the whole suite.
withDefault('LOG_LEVEL', 'fatal');
