// Starts a real PostgreSQL in userspace (no Docker, no root) via embedded-postgres,
// then applies migrations and seeds. Reusable by start-local.mjs, or run directly
// (`pnpm db:local`) to keep just the database up.
import EmbeddedPostgres from 'embedded-postgres';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const apiDir = resolve(root, 'apps/api');
const dataDir = resolve(root, '.local/pgdata');

const cfg = {
  user: process.env.DB_USER || 'dental',
  password: process.env.DB_PASSWORD || 'dental',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'dental',
};

function run(cmd, args, label) {
  process.stdout.write(`\n▶ ${label}\n`);
  const res = spawnSync(cmd, args, { cwd: apiDir, stdio: 'inherit', shell: process.platform === 'win32' });
  if (res.status !== 0) throw new Error(`${label} failed (exit ${res.status})`);
}

export async function launchDb() {
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: cfg.user,
    password: cfg.password,
    port: cfg.port,
    persistent: true,
  });

  const alreadyInitialised = existsSync(resolve(dataDir, 'PG_VERSION'));
  if (!alreadyInitialised) {
    process.stdout.write('▶ Initialising local PostgreSQL data directory…\n');
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(cfg.database);
  } catch {
    /* database already exists — fine */
  }
  process.stdout.write(`✓ PostgreSQL ready on 127.0.0.1:${cfg.port} (db=${cfg.database})\n`);

  run('pnpm', ['exec', 'typeorm-ts-node-commonjs', 'migration:run', '-d', 'src/database/data-source.ts'], 'Running migrations');
  run('pnpm', ['exec', 'ts-node', '-r', 'tsconfig-paths/register', 'src/database/seeders/run-seed.ts'], 'Seeding database');

  return pg;
}

// When executed directly, keep the DB running until interrupted.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pg = await launchDb();
  process.stdout.write('\nLocal database is up. Press Ctrl+C to stop.\n');
  const stop = async () => {
    await pg.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => {}, 1 << 30);
}
