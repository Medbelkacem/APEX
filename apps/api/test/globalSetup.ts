/**
 * Runs once, before any worker starts.
 *
 * Jest executes this in its own process, so it does not inherit `setupFiles`
 * and has to establish the test environment itself before touching the
 * database helpers.
 */
import { rm } from 'fs/promises';
import { TEST_DB_NAME, TEST_STORAGE_ROOT } from './support/env';
import { prepareTestDatabase } from './support/database';

export default async function globalSetup(): Promise<void> {
  // Uploads written by a previous run would otherwise accumulate, and a stale
  // blob can make a download test pass for the wrong reason.
  await rm(TEST_STORAGE_ROOT, { recursive: true, force: true });
  await prepareTestDatabase(TEST_DB_NAME);
}
