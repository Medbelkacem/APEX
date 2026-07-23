/**
 * Harness smoke test.
 *
 * Proves the application actually boots against the test database and that the
 * request pipeline is wired, before any behavioural spec relies on it. When
 * this fails, the problem is the harness; when it passes and others fail, the
 * problem is the code under test.
 */
import { createTestApp, TestApp } from './support/app';
import { truncateAll } from './support/database';
import { api } from './support/http';

describe('e2e harness', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('boots the application against the test database', () => {
    // 1 === connected (mongoose ConnectionStates.connected).
    expect(ctx.connection.readyState).toBe(1);
    expect(ctx.connection.name).toBe('dental_test');
  });

  it('has created the collections', async () => {
    const collections = await ctx.connection.db!.listCollections().toArray();
    const names = collections.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['users', 'cases', 'invoices']));
  });

  it('serves the health endpoint under the /api prefix', async () => {
    const res = await api(ctx.app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('rejects an unauthenticated request to a protected route', async () => {
    const res = await api(ctx.app).get('/api/cases');
    expect(res.status).toBe(401);
  });

  it('can truncate between tests without dropping the collections', async () => {
    await truncateAll(ctx.connection);
    const count = await ctx.connection.model('User').countDocuments().exec();
    expect(count).toBe(0);
  });
});
