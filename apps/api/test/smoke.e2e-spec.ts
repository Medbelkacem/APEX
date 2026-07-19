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
    expect(ctx.dataSource.isInitialized).toBe(true);
    expect(ctx.dataSource.options.database).toBe('dental_test');
  });

  it('has applied the migrations', async () => {
    const tables: { tablename: string }[] = await ctx.dataSource.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const names = tables.map((t) => t.tablename);
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

  it('can truncate between tests without dropping the schema', async () => {
    await truncateAll(ctx.dataSource);
    const [{ count }] = await ctx.dataSource.query(`SELECT COUNT(*)::int AS count FROM users`);
    expect(count).toBe(0);
  });
});
