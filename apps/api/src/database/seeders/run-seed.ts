import { AppDataSource } from '../data-source';
import { seedAdmin } from './seed-admin';
import { seedCaseStatuses } from './seed-case-statuses';
import { seedCaseTypes } from './seed-case-types';

/**
 * Idempotent seed runner. Safe to run repeatedly — each seeder skips records
 * that already exist. Invoked via `pnpm db:seed`.
 */
async function run(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Seeding database...');
  await AppDataSource.initialize();
  try {
    await seedAdmin(AppDataSource);
    await seedCaseStatuses(AppDataSource);
    await seedCaseTypes(AppDataSource);
    // eslint-disable-next-line no-console
    console.log('Seed complete.');
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
