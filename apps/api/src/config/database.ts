import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { entities } from '../database/entities';

const useSsl = ['1', 'true', 'yes', 'on'].includes(
  (process.env.DB_SSL ?? 'false').toLowerCase(),
);

/**
 * TypeORM options for the Nest application. Migrations are run via the CLI
 * data-source (see database/data-source.ts) — `synchronize` is always OFF so
 * the schema is only ever changed through versioned, reversible migrations.
 */
export const databaseConfig = registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? 'dental',
    password: process.env.DB_PASSWORD ?? 'dental',
    database: process.env.DB_NAME ?? 'dental',
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    entities,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    migrationsRun: false,
    autoLoadEntities: true,
    logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  }),
);

export type DatabaseConfig = ReturnType<typeof databaseConfig>;
