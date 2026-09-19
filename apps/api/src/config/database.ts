import { registerAs } from '@nestjs/config';
import { MongooseModuleFactoryOptions } from '@nestjs/mongoose';

/** Assemble the MongoDB connection string from discrete parts when no URI is given. */
export function resolveMongoUri(): string {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;

  const host = process.env.MONGO_HOST ?? 'localhost';
  const port = process.env.MONGO_PORT ?? '27017';
  const db = process.env.MONGO_DB ?? 'dental';
  const user = process.env.MONGO_USER ?? '';
  const password = process.env.MONGO_PASSWORD ?? '';
  const credentials = user ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@` : '';
  // directConnection keeps a single-node replica set reachable without SRV/seedlist
  // discovery — the shape both the docker stack and the in-memory dev/test server use.
  const params = new URLSearchParams({ directConnection: 'true' });
  if (process.env.MONGO_REPLICA_SET) params.set('replicaSet', process.env.MONGO_REPLICA_SET);
  if (credentials) params.set('authSource', process.env.MONGO_AUTH_SOURCE ?? 'admin');
  return `mongodb://${credentials}${host}:${port}/${db}?${params.toString()}`;
}

/**
 * Mongoose options for the Nest application. Schemas own their own indexes;
 * `autoIndex` builds them on connect (the dataset is small enough that this is
 * cheaper than a separate migration step).
 */
export const databaseConfig = registerAs(
  'database',
  (): MongooseModuleFactoryOptions => ({
    uri: resolveMongoUri(),
    autoIndex: true,
    // Fail fast instead of buffering commands for 10s when Mongo is unreachable.
    serverSelectionTimeoutMS: 5000,
    // serverSelectionTimeoutMS bounds waiting for a *known-good* server, not
    // the raw socket connect — a network path that silently drops packets
    // (a firewalled/blocked IP, not a refused connection) hangs in the
    // driver's own connect step regardless, for as long as connectTimeoutMS
    // allows. Bounding that too turns a serverless function timing out
    // opaquely at its own ceiling into a clear, fast "can't reach Mongo"
    // error instead.
    connectTimeoutMS: 5000,
    // @nestjs/mongoose retries a failed initial connection on its own; left at
    // its default this can retry for far longer than a serverless function's
    // own execution ceiling, turning a fast, clear connection error into an
    // opaque platform timeout instead. One retry is still real resilience
    // against a one-off blip, just bounded.
    retryAttempts: 1,
    retryDelay: 1000,
  }),
);

export type DatabaseConfig = ReturnType<typeof databaseConfig>;
