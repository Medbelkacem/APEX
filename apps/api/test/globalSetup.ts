/**
 * Runs once, before any worker starts.
 *
 * Jest executes this in its own process, so it does not inherit `setupFiles`
 * and has to establish the test environment itself before touching the
 * database helpers. The in-memory MongoDB it starts here has its connection
 * string exported to `process.env`, which every forked worker inherits.
 */
import { rm } from 'fs/promises';
import { TEST_DB_NAME, TEST_STORAGE_ROOT } from './support/env';
import { createTestMongo } from './support/database';

export default async function globalSetup(): Promise<void> {
  // Uploads written by a previous run would otherwise accumulate, and a stale
  // blob can make a download test pass for the wrong reason.
  await rm(TEST_STORAGE_ROOT, { recursive: true, force: true });

  const { uri, replset } = await createTestMongo(TEST_DB_NAME);
  process.env.MONGODB_URI = uri;
  // Kept on the global so globalTeardown can stop the same instance.
  (globalThis as Record<string, unknown>).__MONGO_REPLSET__ = replset;
}
