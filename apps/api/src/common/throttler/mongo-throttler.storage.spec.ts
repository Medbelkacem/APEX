import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection, Model } from 'mongoose';
import { RateLimitHit, RateLimitHitSchema } from '../../database/entities';
import { MongoThrottlerStorage } from './mongo-throttler.storage';

describe('MongoThrottlerStorage', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let model: Model<RateLimitHit>;
  let storage: MongoThrottlerStorage;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = await mongoose.createConnection(mongod.getUri()).asPromise();
    model = connection.model(RateLimitHit.name, RateLimitHitSchema);
  }, 30_000);

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await model.deleteMany({});
    storage = new MongoThrottlerStorage(model);
  });

  it('counts hits within a window and stays unblocked at the limit', async () => {
    const key = 'tracker-a';
    let record = await storage.increment(key, 60_000, 3, 30_000, 'default');
    expect(record).toMatchObject({ totalHits: 1, isBlocked: false });

    record = await storage.increment(key, 60_000, 3, 30_000, 'default');
    expect(record).toMatchObject({ totalHits: 2, isBlocked: false });

    record = await storage.increment(key, 60_000, 3, 30_000, 'default');
    expect(record).toMatchObject({ totalHits: 3, isBlocked: false });
  });

  it('blocks once the limit is exceeded', async () => {
    const key = 'tracker-b';
    for (let i = 0; i < 2; i++) await storage.increment(key, 60_000, 2, 30_000, 'default');

    const record = await storage.increment(key, 60_000, 2, 30_000, 'default');
    expect(record.isBlocked).toBe(true);
    expect(record.timeToBlockExpire).toBeGreaterThan(0);
  });

  it('keeps a caller blocked for the whole blockDuration, without counting further hits', async () => {
    const key = 'tracker-c';
    for (let i = 0; i < 3; i++) await storage.increment(key, 60_000, 2, 30_000, 'default');

    const record = await storage.increment(key, 60_000, 2, 30_000, 'default');
    expect(record.isBlocked).toBe(true);
    // The 4th call landed while still blocked — no new hit was recorded.
    expect(record.totalHits).toBe(3);
  });

  it('unblocks and starts a fresh count once the block has lapsed, even mid-window', async () => {
    const key = 'tracker-d';
    await storage.increment(key, 60_000, 1, 1, 'default'); // 1st hit: at the limit, not blocked
    const blocked = await storage.increment(key, 60_000, 1, 1, 'default'); // 2nd: over limit
    expect(blocked.isBlocked).toBe(true);

    await new Promise((r) => setTimeout(r, 20)); // outlast the 1ms blockDuration

    const record = await storage.increment(key, 60_000, 1, 1, 'default');
    expect(record.isBlocked).toBe(false);
    expect(record.totalHits).toBe(1);
  });

  it('starts a fresh window once the previous one has expired', async () => {
    const key = 'tracker-e';
    await storage.increment(key, 1, 5, 30_000, 'default'); // 1ms window
    await new Promise((r) => setTimeout(r, 20));

    const record = await storage.increment(key, 1, 5, 30_000, 'default');
    expect(record.totalHits).toBe(1);
  });

  it('tracks separate throttlers on the same key independently', async () => {
    const key = 'shared-tracker';
    const a = await storage.increment(key, 60_000, 5, 30_000, 'strict');
    const b = await storage.increment(key, 60_000, 5, 30_000, 'lenient');
    expect(a.totalHits).toBe(1);
    expect(b.totalHits).toBe(1);
  });
});
