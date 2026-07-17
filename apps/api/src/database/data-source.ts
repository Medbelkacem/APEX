import 'reflect-metadata';
import { join } from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { entities } from './entities';

// Load the monorepo-root .env so the CLI (migrations/seed) sees the same config
// as the running app. __dirname = apps/api/src/database → up 4 levels to root.
dotenv.config({ path: join(__dirname, '../../../../.env') });

const useSsl = ['1', 'true', 'yes', 'on'].includes((process.env.DB_SSL ?? 'false').toLowerCase());

/**
 * Standalone TypeORM data-source used by the CLI for migrations and seeding.
 * Kept in sync with config/database.ts (same entities + naming strategy).
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'dental',
  password: process.env.DB_PASSWORD ?? 'dental',
  database: process.env.DB_NAME ?? 'dental',
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  entities,
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
});
