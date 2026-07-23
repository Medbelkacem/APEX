/**
 * Test database lifecycle.
 *
 * The suite runs against a real MongoDB — an in-memory `MongoMemoryReplSet`
 * (single-node replica set) started once in globalSetup. A replica set rather
 * than a standalone mongod because case/invoice numbering and the multi-document
 * writes (case + history, invoice + line items) run inside transactions, which
 * MongoDB only permits on a replica set.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Connection } from 'mongoose';

/** Start an in-memory replica set and return it plus its connection string. */
export async function createTestMongo(
  databaseName: string,
): Promise<{ uri: string; replset: MongoMemoryReplSet }> {
  const replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  return { uri: replset.getUri(databaseName), replset };
}

/**
 * Empty every collection between tests while leaving indexes in place — the
 * MongoDB equivalent of `TRUNCATE ... RESTART IDENTITY`. Clearing the counters
 * collection resets sequential references (CASE-2026-0001, INV-2026-0001) to a
 * known point for every test.
 */
export async function truncateAll(connection: Connection): Promise<void> {
  const collections = Object.values(connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
}
