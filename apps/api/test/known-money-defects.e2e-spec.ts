/**
 * Confirmed money-path defects, pending a fix.
 *
 * Every test here asserts the behaviour the platform *should* have, and is
 * marked `it.failing()` because the platform does not currently have it. Jest
 * reports these as passing while the defect exists and starts failing the
 * moment it is fixed — at which point delete the `.failing` and the test
 * becomes an ordinary regression guard.
 *
 * All five were reproduced end to end against the real services on
 * 2026-07-18; none is speculative. They are financial-correctness bugs, so
 * they are recorded rather than quietly left undiscovered:
 *
 *   1. `PaymentsService.refund` has no status guard, so a second call issues a
 *      second Stripe refund before `markRefunded` rejects it. Reachable by any
 *      admin via `POST /api/invoices/:id/refund`.
 *   2. `markPaid` guards only PAID and CANCELLED, so a redelivered
 *      `payment_intent.succeeded` turns a REFUNDED invoice back into PAID.
 *   3. Settlement trusts `metadata.invoiceId` alone and never compares
 *      `amount_received`/`currency` — a one-cent intent settles a $100 invoice
 *      in full.
 *   4. `pdfFor` regenerates a statement when its PDF blob is missing, and
 *      `generate` recomputes balances from *current* invoice status. Merely
 *      downloading an old statement can therefore restate it.
 *   5. Statement totals count a REFUNDED invoice as invoiced but not paid, so
 *      every refund permanently overstates the closing balance.
 */
import { INestApplication } from '@nestjs/common';
import { InvoiceStatus } from '@dental/shared-types';
import { Invoice } from '../src/database/entities/invoice.entity';
import { MonthlyStatement } from '../src/database/entities/monthly-statement.entity';
import { SETTING_KEYS, SettingsService } from '../src/modules/settings/settings.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { StorageService } from '../src/storage/storage.service';
import { createTestApp, TestApp } from './support/app';
import { truncateAll } from './support/database';
import { Fixtures } from './support/factories';
import { api, login, Session } from './support/http';

const mockPaymentIntents = { create: jest.fn(), retrieve: jest.fn() };
const mockWebhooks = { constructEvent: jest.fn() };
const mockRefunds = { create: jest.fn() };

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    paymentIntents: mockPaymentIntents,
    webhooks: mockWebhooks,
    refunds: mockRefunds,
  })),
}));

describe('money-path defects', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let fixtures: Fixtures;
  let settings: SettingsService;
  let payments: PaymentsService;

  let catalog: Awaited<ReturnType<Fixtures['catalog']>>;
  let dentist: Awaited<ReturnType<Fixtures['dentist']>>;
  let dentistSession: Session;
  let adminSession: Session;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    fixtures = new Fixtures(ctx.dataSource);
    settings = ctx.moduleRef.get(SettingsService);
    payments = ctx.moduleRef.get(PaymentsService);
  });

  afterAll(async () => ctx.close());

  beforeEach(async () => {
    jest.clearAllMocks();
    await truncateAll(ctx.dataSource);
    catalog = await fixtures.catalog();
    dentist = await fixtures.dentist();
    const admin = await fixtures.admin();
    dentistSession = await login(app, dentist.user.email);
    adminSession = await login(app, admin.email);
    await settings.set(SETTING_KEYS.stripeSecretKey, 'sk_test_realistic');
    await settings.set(SETTING_KEYS.stripePublishableKey, 'pk_test_realistic');
    await settings.set(SETTING_KEYS.stripeWebhookSecret, 'whsec_test_secret');
  });

  async function paidInvoice(): Promise<Invoice> {
    const c = await api(app)
      .post('/api/cases')
      .set('Cookie', dentistSession.cookie)
      .send({ caseTypeId: catalog.caseType.id, patientReference: 'PT-D' });
    const gen = await api(app)
      .post('/api/invoices/generate')
      .set('Cookie', adminSession.cookie)
      .send({ caseId: c.body.id });
    await api(app).post(`/api/invoices/${gen.body.id}/issue`).set('Cookie', adminSession.cookie);

    mockPaymentIntents.create.mockResolvedValue({ id: 'pi_d', client_secret: 'cs' });
    await api(app)
      .post(`/api/invoices/${gen.body.id}/payment-intent`)
      .set('Cookie', dentistSession.cookie);

    await api(app).post(`/api/invoices/${gen.body.id}/mark-paid`).set('Cookie', adminSession.cookie);
    return ctx.dataSource.getRepository(Invoice).findOneByOrFail({ id: gen.body.id });
  }

  const reload = (id: string) => ctx.dataSource.getRepository(Invoice).findOneByOrFail({ id });

  it.failing('DEFECT 1: refunding twice must not issue two Stripe refunds', async () => {
    const inv = await paidInvoice();
    mockRefunds.create.mockResolvedValue({ id: 're_1' });

    await payments.refund(inv.id);
    await payments.refund(inv.id).catch(() => undefined);

    expect(mockRefunds.create).toHaveBeenCalledTimes(1);
  });

  it.failing('DEFECT 2: a redelivered success webhook must not un-refund an invoice', async () => {
    const inv = await paidInvoice();
    mockRefunds.create.mockResolvedValue({ id: 're_1' });
    await payments.refund(inv.id);
    expect((await reload(inv.id)).status).toBe(InvoiceStatus.REFUNDED);

    mockWebhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_d', metadata: { invoiceId: inv.id } } },
    });
    await api(app).post('/api/payments/webhook').set('stripe-signature', 'sig').send({});

    expect((await reload(inv.id)).status).toBe(InvoiceStatus.REFUNDED);
  });

  it.failing('DEFECT 3: settlement must verify the amount Stripe actually collected', async () => {
    const inv = await paidInvoice();
    await ctx.dataSource
      .getRepository(Invoice)
      .update(inv.id, { status: InvoiceStatus.ISSUED, paidAt: null });

    mockWebhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_d',
          metadata: { invoiceId: inv.id },
          amount_received: 1, // one cent against a $100.00 invoice
          currency: 'usd',
        },
      },
    });
    await api(app).post('/api/payments/webhook').set('stripe-signature', 'sig').send({});

    expect((await reload(inv.id)).status).not.toBe(InvoiceStatus.PAID);
  });

  it.failing('DEFECT 4: downloading a statement must not rewrite its stored figures', async () => {
    const c = await api(app)
      .post('/api/cases')
      .set('Cookie', dentistSession.cookie)
      .send({ caseTypeId: catalog.caseType.id, patientReference: 'PT-S' });
    const gen = await api(app)
      .post('/api/invoices/generate')
      .set('Cookie', adminSession.cookie)
      .send({ caseId: c.body.id });
    await api(app).post(`/api/invoices/${gen.body.id}/issue`).set('Cookie', adminSession.cookie);
    await ctx.dataSource.getRepository(Invoice).update(gen.body.id, { issueDate: '2025-03-10' });

    const statement = await api(app)
      .post('/api/statements/generate')
      .set('Cookie', adminSession.cookie)
      .send({ dentistId: dentist.dentist.id, year: 2025, month: 3 });
    const before = await ctx.dataSource
      .getRepository(MonthlyStatement)
      .findOneByOrFail({ id: statement.body.id });

    // The invoice is settled later, then the cached PDF goes missing — storage
    // cleared, a migration, or a blob that was never written. Nulling the DB
    // column alone is not enough: `pdfFor` derives the path and checks the
    // filesystem, so the blob itself has to be gone to reach the regenerate path.
    await api(app).post(`/api/invoices/${gen.body.id}/mark-paid`).set('Cookie', adminSession.cookie);
    const storage = ctx.moduleRef.get(StorageService);
    await storage.delete(
      storage.statementPdfPath(dentist.dentist.id, 2025, 3),
    );
    await ctx.dataSource
      .getRepository(MonthlyStatement)
      .update(statement.body.id, { pdfPath: null });

    await api(app)
      .get(`/api/statements/${statement.body.id}/pdf`)
      .set('Cookie', adminSession.cookie)
      .buffer()
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (x: Buffer) => chunks.push(x));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    const after = await ctx.dataSource
      .getRepository(MonthlyStatement)
      .findOneByOrFail({ id: statement.body.id });

    // A statement is a historical record; reading it must not restate it.
    expect(after.totalPaid).toBe(before.totalPaid);
    expect(after.closingBalance).toBe(before.closingBalance);
  });

  it.failing('DEFECT 5: a refunded invoice must not count as both invoiced and unpaid', async () => {
    const inv = await paidInvoice();
    await ctx.dataSource.getRepository(Invoice).update(inv.id, { issueDate: '2025-03-10' });
    mockRefunds.create.mockResolvedValue({ id: 're_1' });
    await payments.refund(inv.id);

    const statement = await api(app)
      .post('/api/statements/generate')
      .set('Cookie', adminSession.cookie)
      .send({ dentistId: dentist.dentist.id, year: 2025, month: 3 });

    // Money that was refunded is owed by nobody.
    expect(statement.body.closingBalance).toBe('0.00');
  });
});
