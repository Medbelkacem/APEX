/**
 * Test database lifecycle.
 *
 * The suite runs against a real PostgreSQL because the code under test is not
 * portable to an in-memory engine: case and invoice numbering take a
 * transaction-scoped advisory lock (`pg_advisory_xact_lock`), case filtering
 * uses `INTERVAL` arithmetic and `ILIKE`, and every money column is a
 * `decimal` whose string round-tripping is part of what we are asserting.
 * Substituting SQLite would test a different program.
 */
import { DataSource } from 'typeorm';
import { join } from 'path';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { entities } from '../../src/database/entities';

interface Connection {
  host: string;
  port: number;
  user: string;
  password: string;
}

function connection(): Connection {
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'dental',
    password: process.env.DB_PASSWORD ?? 'dental',
  };
}

const UNREACHABLE = (host: string, port: number, reason: string) =>
  `Cannot reach PostgreSQL at ${host}:${port} — ${reason}\n\n` +
  `The e2e suite needs a real database. Start one with:\n` +
  `  pnpm db:local        # userspace PostgreSQL, no Docker\n` +
  `  pnpm docker:up       # or the full Docker stack\n`;

/**
 * Creates the test database if it is absent, then brings it up to the current
 * migration head. Safe to run repeatedly — `CREATE DATABASE` is guarded and
 * TypeORM skips migrations it has already applied.
 */
export async function prepareTestDatabase(databaseName: string): Promise<void> {
  const cfg = connection();
  // Connects to the always-present `postgres` database purely to issue
  // CREATE DATABASE. No entities: this connection must not try to reflect or
  // synchronise a schema, it only runs two statements.
  const admin = new DataSource({
    type: 'postgres',
    ...cfg,
    username: cfg.user,
    database: 'postgres',
    entities: [],
    synchronize: false,
    logging: false,
  });

  try {
    await admin.initialize();
  } catch (error) {
    throw new Error(UNREACHABLE(cfg.host, cfg.port, (error as Error).message));
  }

  try {
    const existing: unknown[] = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );
    if (existing.length === 0) {
      // An identifier, not a value — it cannot be parameterised, so quote it.
      await admin.query(`CREATE DATABASE "${databaseName.replace(/"/g, '""')}"`);
    }
  } finally {
    await admin.destroy();
  }

  const migrator = testDataSource(databaseName);
  await migrator.initialize();
  try {
    await migrator.runMigrations();
  } finally {
    await migrator.destroy();
  }
}

/**
 * A DataSource shaped exactly like the application's (same entities, same
 * snake_case naming strategy) but pinned to the test database. `synchronize`
 * stays off so the suite exercises the real migration output rather than a
 * schema TypeORM inferred from the entities — those two drift, and the
 * migrations are what production runs.
 */
export function testDataSource(databaseName: string): DataSource {
  return new DataSource({
    type: 'postgres',
    ...connection(),
    username: connection().user,
    database: databaseName,
    entities,
    migrations: [join(__dirname, '../../src/database/migrations/*.{ts,js}')],
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: false,
  });
}

/**
 * Empties every table between tests while leaving the schema in place.
 *
 * One `TRUNCATE` over all tables at once is both faster than per-table deletes
 * and immune to foreign-key ordering. `RESTART IDENTITY` resets sequences so
 * generated references (CASE-2026-0001, INV-2026-0001) start from a known
 * point in every test. The migrations bookkeeping table is deliberately
 * excluded — dropping it would force a re-migration on the next test.
 */
export async function truncateAll(dataSource: DataSource): Promise<void> {
  const tables: { tablename: string }[] = await dataSource.query(
    `SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> 'migrations'`,
  );
  if (tables.length === 0) return;

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await dataSource.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
