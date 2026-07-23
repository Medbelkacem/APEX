/**
 * Invoicing — generation, money arithmetic, lifecycle, and scoping.
 *
 * Money is stored in `decimal(10,2)` columns, which the driver returns as
 * strings, and the service converts to integer cents before doing arithmetic.
 * The assertions below compare exact strings on purpose: `toBe('120.00')`
 * catches a float regression that `toBeCloseTo(120)` would wave through.
 */
import { INestApplication } from '@nestjs/common';
import { InvoiceStatus } from '@dental/shared-types';
import { Invoice } from '../src/database/entities/invoice.entity';
import { SETTING_KEYS, SettingsService } from '../src/modules/settings/settings.service';
import { createTestApp, TestApp } from './support/app';
import { truncateAll } from './support/database';
import { Fixtures } from './support/factories';
import { api, login, Session } from './support/http';

describe('Invoices (e2e)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let fixtures: Fixtures;
  let settings: SettingsService;

  let catalog: Awaited<ReturnType<Fixtures['catalog']>>;
  let dentist: Awaited<ReturnType<Fixtures['dentist']>>;
  let dentistSession: Session;
  let adminSession: Session;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    fixtures = new Fixtures(ctx.dataSource);
    settings = ctx.moduleRef.get(SettingsService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.connection);
    catalog = await fixtures.catalog();
    dentist = await fixtures.dentist();
    const admin = await fixtures.admin();
    dentistSession = await login(app, dentist.user.email);
    adminSession = await login(app, admin.email);
  });

  /** Submits a case as the dentist and returns its id. */
  async function submitCase(patientReference = 'PT-001'): Promise<string> {
    const res = await api(app)
      .post('/api/cases')
      .set('Cookie', dentistSession.cookie)
      .send({ caseTypeId: catalog.caseType.id, patientReference });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  const generate = (caseId: string, body: Record<string, unknown> = {}) =>
    api(app)
      .post('/api/invoices/generate')
      .set('Cookie', adminSession.cookie)
      .send({ caseId, ...body });

  describe('generation', () => {
    it('prices a case from the matching pricing rule', async () => {
      const caseId = await submitCase();

      const res = await generate(caseId);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        status: InvoiceStatus.DRAFT,
        dentistId: dentist.dentist.id,
        caseId,
        subtotal: '100.00',
        total: '100.00',
        currency: 'USD',
      });
    });

    it('numbers invoices sequentially within the year', async () => {
      const first = await generate(await submitCase('PT-001'));
      const second = await generate(await submitCase('PT-002'));

      const year = new Date().getFullYear();
      expect(first.body.number).toBe(`INV-${year}-0001`);
      expect(second.body.number).toBe(`INV-${year}-0002`);
    });

    it('applies the configured tax rate', async () => {
      await settings.set(SETTING_KEYS.taxRate, '0.2');
      const caseId = await submitCase();

      const res = await generate(caseId);

      expect(res.body).toMatchObject({
        subtotal: '100.00',
        tax: '20.00',
        total: '120.00',
      });
    });

    it('rounds tax to the cent rather than carrying a float', async () => {
      await settings.set(SETTING_KEYS.taxRate, '0.2');
      const caseType = await fixtures.caseType();
      await fixtures.pricingRule(caseType.id, { price: '33.33' });

      const created = await api(app)
        .post('/api/cases')
        .set('Cookie', dentistSession.cookie)
        .send({ caseTypeId: caseType.id, patientReference: 'PT-ODD' });
      const res = await generate(created.body.id);

      // 3333 cents * 0.2 = 666.6 → 667 cents. Never 6.665999999999999.
      expect(res.body).toMatchObject({
        subtotal: '33.33',
        tax: '6.67',
        total: '40.00',
      });
    });

    it('takes the currency from the pricing rule, not the platform default', async () => {
      const caseType = await fixtures.caseType();
      await fixtures.pricingRule(caseType.id, { price: '80.00', currency: 'EUR' });

      const created = await api(app)
        .post('/api/cases')
        .set('Cookie', dentistSession.cookie)
        .send({ caseTypeId: caseType.id, patientReference: 'PT-EUR' });
      const res = await generate(created.body.id);

      // DEFAULT_CURRENCY is USD; a rule in another currency must win, or an
      // invoice would silently restate its own value.
      expect(res.body.currency).toBe('EUR');
    });

    it('honours an explicit unit price override', async () => {
      const caseId = await submitCase();

      const res = await generate(caseId, { unitPrice: '250.50' });

      expect(res.body).toMatchObject({ subtotal: '250.50', total: '250.50' });
    });

    it('falls back to a zero price when no rule matches the case type', async () => {
      const unpriced = await fixtures.caseType();
      const created = await api(app)
        .post('/api/cases')
        .set('Cookie', dentistSession.cookie)
        .send({ caseTypeId: unpriced.id, patientReference: 'PT-FREE' });

      const res = await generate(created.body.id);

      expect(res.body.total).toBe('0.00');
    });

    it('attaches a line item describing the work', async () => {
      const caseId = await submitCase();

      const res = await generate(caseId);

      expect(res.body.lineItems).toHaveLength(1);
      expect(res.body.lineItems[0]).toMatchObject({ quantity: 1, unitPrice: '100.00' });
    });

    it('refuses to invoice the same case twice', async () => {
      const caseId = await submitCase();
      await generate(caseId);

      const res = await generate(caseId);

      expect(res.status).toBe(400);
    });

    it('rejects an unknown case', async () => {
      const res = await generate('00000000-0000-4000-8000-000000000000');
      expect(res.status).toBe(404);
    });

    it('sets a due date from the requested terms', async () => {
      const caseId = await submitCase();

      const res = await generate(caseId, { dueInDays: 45 });

      const issue = new Date(`${res.body.issueDate}T00:00:00Z`);
      const due = new Date(`${res.body.dueDate}T00:00:00Z`);
      const days = Math.round((due.getTime() - issue.getTime()) / 86_400_000);
      expect(days).toBe(45);
    });

    it('is closed to dentists', async () => {
      const caseId = await submitCase();

      const res = await api(app)
        .post('/api/invoices/generate')
        .set('Cookie', dentistSession.cookie)
        .send({ caseId });

      expect(res.status).toBe(403);
    });
  });

  describe('lifecycle', () => {
    let invoiceId: string;

    beforeEach(async () => {
      const res = await generate(await submitCase());
      invoiceId = res.body.id;
    });

    const act = (action: string, body: Record<string, unknown> = {}) =>
      api(app).post(`/api/invoices/${invoiceId}/${action}`).set('Cookie', adminSession.cookie).send(body);

    it('issues a draft', async () => {
      const res = await act('issue');

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(InvoiceStatus.ISSUED);
    });

    it('refuses to issue the same invoice twice', async () => {
      await act('issue');
      const res = await act('issue');
      expect(res.status).toBe(400);
    });

    it('marks an issued invoice paid and stamps the time', async () => {
      await act('issue');

      const res = await act('mark-paid');

      expect(res.body.status).toBe(InvoiceStatus.PAID);
      expect(res.body.paidAt).toBeTruthy();
    });

    it('cancels a draft', async () => {
      const res = await act('cancel');
      expect(res.body.status).toBe(InvoiceStatus.CANCELLED);
    });

    it('refuses to cancel an invoice that has been paid', async () => {
      await act('issue');
      await act('mark-paid');

      const res = await act('cancel');

      expect(res.status).toBe(400);
    });

    it('refuses to mark a cancelled invoice paid', async () => {
      await act('cancel');
      const res = await act('mark-paid');
      expect(res.status).toBe(400);
    });

    it('refunds only a paid invoice', async () => {
      const tooEarly = await act('refund');
      expect(tooEarly.status).toBe(400);
    });

    it('renders a PDF for the invoice', async () => {
      await act('issue');

      const res = await api(app)
        .get(`/api/invoices/${invoiceId}/pdf`)
        .set('Cookie', adminSession.cookie)
        .buffer()
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      // %PDF- is the file signature; proves a real document, not an error page.
      expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('is closed to dentists', async () => {
      const res = await api(app)
        .post(`/api/invoices/${invoiceId}/issue`)
        .set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(403);
    });
  });

  describe('visibility', () => {
    it('hides drafts from the dentist they belong to', async () => {
      await generate(await submitCase());

      const res = await api(app).get('/api/invoices').set('Cookie', dentistSession.cookie);

      expect(res.body.data).toHaveLength(0);
    });

    it('shows an issued invoice to its dentist', async () => {
      const created = await generate(await submitCase());
      await api(app)
        .post(`/api/invoices/${created.body.id}/issue`)
        .set('Cookie', adminSession.cookie);

      const res = await api(app).get('/api/invoices').set('Cookie', dentistSession.cookie);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(created.body.id);
    });

    it("returns 404 for another dentist's invoice", async () => {
      const created = await generate(await submitCase());
      await api(app)
        .post(`/api/invoices/${created.body.id}/issue`)
        .set('Cookie', adminSession.cookie);

      const other = await fixtures.dentist();
      const otherSession = await login(app, other.user.email);

      const res = await api(app)
        .get(`/api/invoices/${created.body.id}`)
        .set('Cookie', otherSession.cookie);

      expect(res.status).toBe(404);
    });

    it('shows drafts to an admin', async () => {
      await generate(await submitCase());

      const res = await api(app).get('/api/invoices').set('Cookie', adminSession.cookie);

      expect(res.body.data).toHaveLength(1);
    });

    it('totals only what is actually outstanding', async () => {
      const issued = await generate(await submitCase('PT-1'));
      await api(app).post(`/api/invoices/${issued.body.id}/issue`).set('Cookie', adminSession.cookie);

      const paid = await generate(await submitCase('PT-2'));
      await api(app).post(`/api/invoices/${paid.body.id}/issue`).set('Cookie', adminSession.cookie);
      await api(app)
        .post(`/api/invoices/${paid.body.id}/mark-paid`)
        .set('Cookie', adminSession.cookie);

      // A third invoice left as a draft must not count either.
      await generate(await submitCase('PT-3'));

      const res = await api(app)
        .get('/api/invoices/outstanding')
        .set('Cookie', dentistSession.cookie);

      expect(res.body).toMatchObject({ total: '100.00', count: 1 });
    });
  });

  describe('batch generation', () => {
    it('bills every uninvoiced completed case on one invoice', async () => {
      const first = await submitCase('PT-1');
      const second = await submitCase('PT-2');
      for (const id of [first, second]) {
        await api(app)
          .patch(`/api/cases/${id}/status`)
          .set('Cookie', adminSession.cookie)
          .send({ caseStatusId: catalog.terminalStatus.id });
      }

      const res = await api(app)
        .post('/api/invoices/generate-batch')
        .set('Cookie', adminSession.cookie)
        .send({ dentistId: dentist.dentist.id });

      expect(res.status).toBe(201);
      expect(res.body.created).toBe(2);
      expect(res.body.invoice.total).toBe('200.00');
      expect(res.body.invoice.lineItems).toHaveLength(2);
    });

    it('skips cases that are still in progress', async () => {
      await submitCase('PT-OPEN');

      const res = await api(app)
        .post('/api/invoices/generate-batch')
        .set('Cookie', adminSession.cookie)
        .send({ dentistId: dentist.dentist.id });

      expect(res.body.created).toBe(0);
      expect(res.body.invoice).toBeNull();
    });

    it('does not re-bill a case that already has an invoice', async () => {
      const caseId = await submitCase();
      await api(app)
        .patch(`/api/cases/${caseId}/status`)
        .set('Cookie', adminSession.cookie)
        .send({ caseStatusId: catalog.terminalStatus.id });
      await generate(caseId);

      const res = await api(app)
        .post('/api/invoices/generate-batch')
        .set('Cookie', adminSession.cookie)
        .send({ dentistId: dentist.dentist.id });

      expect(res.body.created).toBe(0);
    });
  });

  describe('persistence', () => {
    it('stores money as fixed-scale decimal strings', async () => {
      await settings.set(SETTING_KEYS.taxRate, '0.2');
      const created = await generate(await submitCase());

      const stored = await ctx.dataSource
        .getRepository(Invoice)
        .findOneByOrFail({ id: created.body.id });

      // decimal(10,2) round-trips as a string; a number here means precision loss.
      expect(typeof stored.total).toBe('string');
      expect(stored.total).toBe('120.00');
    });
  });
});
