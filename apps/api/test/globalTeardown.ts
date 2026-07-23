import type { MongoMemoryReplSet } from 'mongodb-memory-server';

/** Stop the in-memory MongoDB started in globalSetup. */
export default async function globalTeardown(): Promise<void> {
  const replset = (globalThis as Record<string, unknown>).__MONGO_REPLSET__ as
    | MongoMemoryReplSet
    | undefined;
  if (replset) await replset.stop();
}
