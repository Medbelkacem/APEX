import { join } from 'path';
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import { resolveMongoUri } from '../../config/database';
import {
  CaseStatus,
  CaseStatusSchema,
  CaseType,
  CaseTypeSchema,
  User,
  UserSchema,
} from '../entities';
import { seedAdmin } from './seed-admin';
import { seedCaseStatuses } from './seed-case-statuses';
import { seedCaseTypes } from './seed-case-types';

// Load the monorepo-root .env so the CLI sees the same config as the app.
// __dirname = apps/api/src/database/seeders → up 5 levels to root.
dotenv.config({ path: join(__dirname, '../../../../../.env') });

/**
 * Idempotent seed runner. Safe to run repeatedly — each seeder skips records
 * that already exist. Invoked via `pnpm db:seed`.
 */
async function run(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Seeding database...');
  await mongoose.connect(resolveMongoUri());
  try {
    const userModel = mongoose.model(User.name, UserSchema);
    const caseStatusModel = mongoose.model(CaseStatus.name, CaseStatusSchema);
    const caseTypeModel = mongoose.model(CaseType.name, CaseTypeSchema);

    await seedAdmin(userModel);
    await seedCaseStatuses(caseStatusModel);
    await seedCaseTypes(caseTypeModel);
    // eslint-disable-next-line no-console
    console.log('Seed complete.');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
