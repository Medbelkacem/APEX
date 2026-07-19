/**
 * Monthly statements — period selection, totals, idempotency, and scoping.
 *
 * Period boundaries are built in UTC and compared against `issueDate`, which
 * is a `date` column and therefore timezone-free. Tests place invoices by
 * writing `issueDate` directly, because generation always stamps today.
 */
import { INestApplication } from '@nestjs/common';
import { Invoice } from '../src/database/entities/invoice.entity';
import { MonthlyStatement } from '../src/database/entities/monthly-statement.entity';
import { createTestApp, TestApp } from './support/app';
import { truncateAll } from './support/database';
import { Fixtures } from './support/factories';
import { api, login, Session } from './support/http';

/** A period safely in the past, so "today" can never fall inside it. */
const YEAR = 2025;
const MONTH = 3;

describe('Statements (e2e)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let fixtures: Fixtures;

  let catalog: Awaited<ReturnType<Fixtures['catalog']>>;
  let dentist: Awaited<ReturnType<Fixtures['dentist']>>;
  let dentistSession: Session;
  let adminSession: Session;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    fixtures = new Fixtures(ctx.dataSource);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
    catalog = await fixtures.catalog();
    dentist = await fixtures.dentist();
    const admin = await fixtures.admin();
    dentistSession = await login(app, dentist.user.email);
    adminSession = await login(app, admin.email);
  });

  /**
   * Creates an invoice, drives it to `status`, then backdates `issueDate` into
   * the given month so the statement's period filter picks it up.
   */
  async function invoiceIn(
    issueDate: string,
    options: { status?: 'draft' | 'issued' | 'paid'; patientReference?: string } = {},
  ): Promise<Invoice> {
    const { status = 'issued', patientReference = `PT-${issueDate}` } = options;

    const created = await api(app)
      .post('/api/cases')
      .set('Cookie', dentistSession.cookie)
      .send({ caseTypeId: catalog.caseType.id, patientReference });

    const invoice = await api(app)
      .post('/api/invoices/generate')
      .set('Cookie', adminSession.cookie)
      .send({ caseId: created.body.id });

    if (status !== 'draft') {
      await api(app)
        .post(`/api/invoices/${invoice.body.id}/issue`)
        .set('Cookie', adminSession.cookie);
    }
    if (status === 'paid') {
      await api(app)
        .post(`/api/invoices/${invoice.body.id}/mark-paid`)
        .set('Cookie', adminSession.cookie);
    }

    const repo = ctx.dataSource.getRepository(Invoice);
    await repo.update(invoice.body.id, { issueDate });
    return repo.findOneByOrFail({ id: invoice.body.id });
  }

  const generate = (body: Record<string, unknown> = {}) =>
    api(app)
      .post('/api/statements/generate')
      .set('Cookie', adminSession.cookie)
      .send({ dentistId: dentist.dentist.id, year: YEAR, month: MONTH, ...body });

  describe('generation', () => {
    it('totals the invoices issued within the period', async () => {
      await invoiceIn('2025-03-05');
      await invoiceIn('2025-03-20');

      const res = await generate();

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        dentistId: dentist.dentist.id,
        periodYear: YEAR,
        periodMonth: MONTH,
        totalInvoiced: '200.00',
      });
    });

    it('includes the first and last day of the month', async () => {
      await invoiceIn('2025-03-01');
      await invoiceIn('2025-03-31');

      const res = await generate();

      expect(res.body.totalInvoiced).toBe('200.00');
    });

    it('excludes invoices from adjacent months', async () => {
      await invoiceIn('2025-02-28');
      await invoiceIn('2025-03-15');
      await invoiceIn('2025-04-01');

      const res = await generate();

      expect(res.body.totalInvoiced).toBe('100.00');
    });

    it('ignores drafts, which are not yet real money', async () => {
      await invoiceIn('2025-03-10', { status: 'issued' });
      await invoiceIn('2025-03-11', { status: 'draft' });

      const res = await generate();

      expect(res.body.totalInvoiced).toBe('100.00');
    });

    it('counts settled invoices as paid', async () => {
      await invoiceIn('2025-03-10', { status: 'paid' });
      await invoiceIn('2025-03-11', { status: 'issued' });

      const res = await generate();

      expect(res.body).toMatchObject({
        totalInvoiced: '200.00',
        totalPaid: '100.00',
      });
    });

    it('produces a zero statement for a period with no activity', async () => {
      const res = await generate();

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        totalInvoiced: '0.00',
        totalPaid: '0.00',
        closingBalance: '0.00',
      });
    });

    it('updates the existing row rather than duplicating a period', async () => {
      await invoiceIn('2025-03-05');
      const first = await generate();

      await invoiceIn('2025-03-06');
      const second = await generate();

      expect(second.body.id).toBe(first.body.id);
      expect(second.body.totalInvoiced).toBe('200.00');

      const rows = await ctx.dataSource.getRepository(MonthlyStatement).find();
      expect(rows).toHaveLength(1);
    });

    it('rejects an out-of-range month', async () => {
      const res = await generate({ month: 13 });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown dentist', async () => {
      const res = await generate({ dentistId: '00000000-0000-4000-8000-000000000000' });
      expect(res.status).toBe(404);
    });

    it('is closed to dentists', async () => {
      const res = await api(app)
        .post('/api/statements/generate')
        .set('Cookie', dentistSession.cookie)
        .send({ dentistId: dentist.dentist.id, year: YEAR, month: MONTH });

      expect(res.status).toBe(403);
    });
  });

  describe('generate-all', () => {
    it('produces one statement per dentist', async () => {
      const second = await fixtures.dentist();

      const res = await api(app)
        .post('/api/statements/generate-all')
        .set('Cookie', adminSession.cookie)
        .send({ year: YEAR, month: MONTH });

      expect(res.status).toBe(201);
      expect(res.body.created).toBe(2);

      const rows = await ctx.dataSource.getRepository(MonthlyStatement).find();
      expect(rows.map((r) => r.dentistId).sort()).toEqual(
        [dentist.dentist.id, second.dentist.id].sort(),
      );
    });
  });

  describe('visibility', () => {
    it('lets a dentist read their own statement', async () => {
      const created = await generate();

      const res = await api(app)
        .get(`/api/statements/${created.body.id}`)
        .set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
    });

    it("returns 404 for another dentist's statement", async () => {
      const created = await generate();
      const other = await fixtures.dentist();
      const otherSession = await login(app, other.user.email);

      const res = await api(app)
        .get(`/api/statements/${created.body.id}`)
        .set('Cookie', otherSession.cookie);

      expect(res.status).toBe(404);
    });

    it('lists only the caller’s own statements', async () => {
      await generate();
      const other = await fixtures.dentist();
      await api(app)
        .post('/api/statements/generate')
        .set('Cookie', adminSession.cookie)
        .send({ dentistId: other.dentist.id, year: YEAR, month: MONTH });

      const res = await api(app).get('/api/statements').set('Cookie', dentistSession.cookie);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].dentistId).toBe(dentist.dentist.id);
    });

    it('shows an admin every dentist’s statements', async () => {
      await generate();
      const other = await fixtures.dentist();
      await api(app)
        .post('/api/statements/generate')
        .set('Cookie', adminSession.cookie)
        .send({ dentistId: other.dentist.id, year: YEAR, month: MONTH });

      const res = await api(app).get('/api/statements').set('Cookie', adminSession.cookie);

      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('documents', () => {
    it('renders the statement as a PDF', async () => {
      await invoiceIn('2025-03-05');
      const created = await generate();

      const res = await api(app)
        .get(`/api/statements/${created.body.id}/pdf`)
        .set('Cookie', dentistSession.cookie)
        .buffer()
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('records when a statement was sent', async () => {
      const created = await generate();

      const res = await api(app)
        .post(`/api/statements/${created.body.id}/send`)
        .set('Cookie', adminSession.cookie);

      expect(res.status).toBe(201);

      const stored = await ctx.dataSource
        .getRepository(MonthlyStatement)
        .findOneByOrFail({ id: created.body.id });
      expect(stored.sentAt).not.toBeNull();
    });
  });
});
